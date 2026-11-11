package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Drives the real resend-java SDK against a JDK HttpServer that answers like Resend's /emails endpoint. */
class ResendEmailSenderTests {
    private static final byte[] PHOTO = {(byte) 0xFF, (byte) 0xD8, 1, 2, 3};
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private HttpServer server;
    private volatile int status;
    private volatile String reply;
    private volatile String received;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/emails", exchange -> {
            received = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            var bytes = reply.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        answer(200, "{\"id\":\"49a3999c-0ce1-4ea6-ab68-afcd6dc2e794\"}");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void aMessageCarriesItsAddressesTextAndBase64Attachments() {
        sender("Upkeep <work@upkeep.example>", "estate@upkeep.example").send(email(null));

        var body = JSON.readTree(received);
        assertEquals("Upkeep <work@upkeep.example>", body.get("from").asString());
        assertEquals("faults@acme.example", first(body.get("to")));
        assertEquals("Work order WO-1", body.get("subject").asString());
        assertEquals("Hello Acme", body.get("text").asString());
        assertEquals("estate@upkeep.example", first(body.get("reply_to")));
        var attachment = body.get("attachments").get(0);
        assertEquals("photo-1.jpg", attachment.get("filename").asString());
        assertEquals(
                Base64.getEncoder().encodeToString(PHOTO),
                attachment.get("content").asString());
        assertFalse(attachment.has("path"));
    }

    @Test
    void theMessagesOwnReplyToWinsOverTheConfiguredOne() {
        sender("work@upkeep.example", "estate@upkeep.example").send(email("manager@upkeep.example"));

        assertEquals("manager@upkeep.example", first(JSON.readTree(received).get("reply_to")));
    }

    @Test
    void noReplyToIsSentWhenNoneIsConfigured() {
        sender("work@upkeep.example", "").send(email(null));

        var replyTo = JSON.readTree(received).get("reply_to");
        assertTrue(replyTo == null || replyTo.isNull() || replyTo.isEmpty());
    }

    @Test
    void rejectedCredentialsAreAuth() {
        answer(401, error(401, "missing_api_key"));
        assertEquals("AUTH", failure());
        answer(403, error(403, "invalid_api_key"));
        assertEquals("AUTH", failure());
    }

    @Test
    void anOversizedMessageIsTooLarge() {
        answer(413, error(413, "content_too_large"));
        assertEquals("MESSAGE_TOO_LARGE", failure());
        answer(422, error(422, "validation_error", "Attachments size exceeds the 40MB limit."));
        assertEquals("MESSAGE_TOO_LARGE", failure());
    }

    @Test
    void aValidationErrorIsAnInvalidMessage() {
        answer(422, error(422, "validation_error", "The upkeep.example domain is not verified."));
        assertEquals("MESSAGE_INVALID", failure());
    }

    @Test
    void rateLimitsServerErrorsAndNetworkFailuresAreProviderErrors() {
        answer(429, error(429, "rate_limit_exceeded"));
        assertEquals("PROVIDER_ERROR", failure());
        answer(500, error(500, "internal_server_error"));
        assertEquals("PROVIDER_ERROR", failure());
        server.stop(0);
        assertEquals("PROVIDER_ERROR", failure());
    }

    private String failure() {
        return assertThrows(
                        EmailSendException.class,
                        () -> sender("work@upkeep.example", "").send(email(null)))
                .code();
    }

    private ResendEmailSender sender(String from, String replyTo) {
        return new ResendEmailSender(
                "re_test", "http://127.0.0.1:" + server.getAddress().getPort(), from, replyTo);
    }

    private void answer(int status, String reply) {
        this.status = status;
        this.reply = reply;
    }

    private static String error(int status, String name) {
        return error(status, name, name);
    }

    private static String error(int status, String name, String message) {
        return "{\"statusCode\":%d,\"name\":\"%s\",\"message\":\"%s\"}".formatted(status, name, message);
    }

    private static String first(JsonNode node) {
        return node.isArray() ? node.get(0).asString() : node.asString();
    }

    private static OutboundEmail email(String replyTo) {
        return new OutboundEmail(
                "faults@acme.example",
                "Work order WO-1",
                "Hello Acme",
                replyTo,
                List.of(new OutboundEmail.Attachment("photo-1.jpg", "image/jpeg", PHOTO)));
    }
}
