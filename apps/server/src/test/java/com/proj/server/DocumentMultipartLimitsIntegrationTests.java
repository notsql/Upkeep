package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.oauth2.jwt.Jwt;

/** Real HTTP multipart requests exercise servlet limits which MockMultipartFile bypasses. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
class DocumentMultipartLimitsIntegrationTests extends DocumentTestSupport {
    @LocalServerPort
    int port;

    @ParameterizedTest
    @ValueSource(ints = {5_000_001, 5_242_881})
    void applicationAndServletSizeFailuresBothReturnActionable413Responses(int size) throws Exception {
        when(decoder.decode("document-token"))
                .thenReturn(Jwt.withTokenValue("document-token")
                        .header("alg", "RS256")
                        .subject("crew")
                        .build());
        var bytes = Arrays.copyOf(pdf(), size);
        Arrays.fill(bytes, pdf().length, bytes.length, (byte) ' ');
        var response = postMultipart(bytes, 1);

        assertEquals(413, response.statusCode());
        assertTrue(json.readTree(response.body()).get("message").asText().contains("5 MB"));
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void requestsAboveTheAggregateServletLimitDoNotReachStorage() throws Exception {
        when(decoder.decode("document-token"))
                .thenReturn(Jwt.withTokenValue("document-token")
                        .header("alg", "RS256")
                        .subject("crew")
                        .build());
        var response = postMultipart(new byte[4_500_000], 4);

        assertEquals(413, response.statusCode());
        assertFalse(json.readTree(response.body()).get("message").asText().isBlank());
        assertTrue(STORAGE.objects.isEmpty());
    }

    private HttpResponse<String> postMultipart(byte[] file, int count) throws Exception {
        var output = new ByteArrayOutputStream();
        output.write(
                "--document-test-boundary\r\nContent-Disposition: form-data; name=\"documentType\"\r\n\r\nINVOICE\r\n"
                        .getBytes(StandardCharsets.US_ASCII));
        for (int i = 0; i < count; i++) {
            output.write(
                    ("--document-test-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"invoice" + i
                                    + ".pdf\"\r\nContent-Type: application/pdf\r\n\r\n")
                            .getBytes(StandardCharsets.US_ASCII));
            output.write(file);
            output.write("\r\n".getBytes(StandardCharsets.US_ASCII));
        }
        output.write("--document-test-boundary--\r\n".getBytes(StandardCharsets.US_ASCII));
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + documents()))
                .header("Authorization", "Bearer document-token")
                .header("Content-Type", "multipart/form-data; boundary=document-test-boundary")
                .POST(HttpRequest.BodyPublishers.ofByteArray(output.toByteArray()))
                .build();
        try (var client = HttpClient.newHttpClient()) {
            return client.send(request, HttpResponse.BodyHandlers.ofString());
        }
    }
}
