package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.GenericContainer;

/** Sends real SMTP to a Mailpit container and reads the delivered message back through Mailpit's API. */
class SmtpWorkOrderEmailSenderTests {
    private static final byte[] PHOTO = {(byte) 0xFF, (byte) 0xD8, 1, 2, 3};

    @SuppressWarnings("resource")
    private static final GenericContainer<?> MAILPIT = new GenericContainer<>("axllent/mailpit:v1.21.0")
            .withEnv("MP_SMTP_AUTH", "upkeep@example.com:secret")
            .withEnv("MP_SMTP_AUTH_ALLOW_INSECURE", "true")
            .withExposedPorts(1025, 8025);

    private static RestClient mailpit;

    @BeforeAll
    static void start() {
        MAILPIT.start();
        mailpit = RestClient.create("http://" + MAILPIT.getHost() + ":" + MAILPIT.getMappedPort(8025));
    }

    @AfterAll
    static void stop() {
        MAILPIT.stop();
    }

    @BeforeEach
    void emptyMailbox() {
        mailpit.delete().uri("/api/v1/messages").retrieve().toBodilessEntity();
    }

    @Test
    void theContractorReceivesTheSubjectBodyAndPhotoAsSent() {
        new SmtpWorkOrderEmailSender(mail("secret"), "", "upkeep@example.com", "").send(email());

        var message = onlyMessage();
        assertEquals("Work order WO-000042: Lift fault at Maple Estate", message.get("Subject"));
        assertEquals("faults@acmelifts.example", address(message, "To"));
        assertEquals("upkeep@example.com", ((Map<?, ?>) message.get("From")).get("Address"));
        var full = mailpit.get()
                .uri("/api/v1/message/{id}", message.get("ID"))
                .retrieve()
                .body(Map.class);
        assertTrue(((String) full.get("Text")).contains("Doors won't open\r\nat level 3")
                || ((String) full.get("Text")).contains("Doors won't open\nat level 3"));
        var attachments = (List<?>) full.get("Attachments");
        assertEquals(1, attachments.size());
        var attachment = (Map<?, ?>) attachments.getFirst();
        assertEquals("photo-1.jpg", attachment.get("FileName"));
        assertEquals("image/jpeg", attachment.get("ContentType"));
        var bytes = mailpit.get()
                .uri("/api/v1/message/{id}/part/{part}", message.get("ID"), attachment.get("PartID"))
                .retrieve()
                .body(byte[].class);
        assertArrayEquals(PHOTO, bytes);
    }

    @Test
    void aConfiguredFromAndReplyToAreUsed() {
        new SmtpWorkOrderEmailSender(
                        mail("secret"), "workorders@example.com", "upkeep@example.com", "agent@example.com")
                .send(email());

        var message = onlyMessage();
        assertEquals("workorders@example.com", ((Map<?, ?>) message.get("From")).get("Address"));
        assertEquals("agent@example.com", address(message, "ReplyTo"));
    }

    @Test
    void rejectedCredentialsAreReportedAsSmtpAuth() {
        var sender = new SmtpWorkOrderEmailSender(mail("wrong"), "", "upkeep@example.com", "");

        var error = assertThrows(WorkOrderSendException.class, () -> sender.send(email()));

        assertEquals("SMTP_AUTH", error.code());
    }

    private static JavaMailSenderImpl mail(String password) {
        var mail = new JavaMailSenderImpl();
        mail.setHost(MAILPIT.getHost());
        mail.setPort(MAILPIT.getMappedPort(1025));
        mail.setUsername("upkeep@example.com");
        mail.setPassword(password);
        var properties = new Properties();
        properties.put("mail.smtp.auth", "true");
        mail.setJavaMailProperties(properties);
        return mail;
    }

    private static WorkOrderEmail email() {
        return WorkOrderEmail.build(new WorkOrderEmail.Content(
                "WO-000042",
                EquipmentType.LIFT,
                "Acme Lifts",
                "faults@acmelifts.example",
                "Maple Estate",
                "1 Maple Road, 123456",
                "Block A › Level 4 › Lift lobby",
                OffsetDateTime.parse("2026-10-26T06:05:00Z"),
                "Lift stuck",
                "Doors won't open\nat level 3",
                List.of(new FaultClassifier.Image(PHOTO, "image/jpeg"))));
    }

    private static Map<?, ?> onlyMessage() {
        var deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (Instant.now().isBefore(deadline)) {
            var messages = (List<?>) mailpit.get()
                    .uri("/api/v1/messages")
                    .retrieve()
                    .body(Map.class)
                    .get("messages");
            if (!messages.isEmpty()) {
                assertEquals(1, messages.size());
                return (Map<?, ?>) messages.getFirst();
            }
            Thread.onSpinWait();
        }
        throw new AssertionError("Mailpit received no message");
    }

    private static String address(Map<?, ?> message, String field) {
        return (String) ((Map<?, ?>) ((List<?>) message.get(field)).getFirst()).get("Address");
    }
}
