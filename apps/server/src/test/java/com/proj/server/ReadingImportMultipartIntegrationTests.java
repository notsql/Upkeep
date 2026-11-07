package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.oauth2.jwt.Jwt;

/** Real Tomcat requests: MockMvc does not enforce servlet multipart byte limits. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
class ReadingImportMultipartIntegrationTests extends ReadingImportTestSupport {
    @LocalServerPort
    int port;

    @BeforeEach
    void authenticateHttpRequests() {
        when(decoder.decode("import-test-token"))
                .thenReturn(Jwt.withTokenValue("import-test-token")
                        .header("alg", "RS256")
                        .subject("import-owner")
                        .build());
    }

    @ParameterizedTest
    @ValueSource(ints = {6 * 1024 * 1024, 25 * 1024 * 1024})
    void admitsValidFilesBeyondTheOldDocumentCeilingAndUpToTheAgreedLimit(int size) throws Exception {
        var response = send(paddedCsv(size), "vendor.csv", "text/csv");
        assertThat(response.statusCode()).isEqualTo(201);
        var batch = JSON.readTree(response.body());
        assertThat(batch.path("importedRows").asInt()).isEqualTo(1);
        assertThat(batch.path("invalidRows").asInt()).isZero();
        assertThat(batch.path("totalRows").asInt()).isBetween(1, 100_000);
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void rejectsAFileOneByteAboveTheLimitWithAnActionable413AndNoInserts() throws Exception {
        var response = send(paddedCsv(25 * 1024 * 1024 + 1), "vendor.csv", "text/csv");
        assertThat(response.statusCode()).isEqualTo(413);
        assertThat(JSON.readTree(response.body()).path("message").asText()).isNotBlank();
        assertThat(list().path("totalItems").asInt()).isZero();
        read(imports(), "import-owner").andExpect(status().isOk());
    }

    @Test
    void rejectsUnsupportedSpreadsheetUploads() throws Exception {
        var response = send(
                new byte[] {'P', 'K', 3, 4},
                "vendor.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        assertThat(response.statusCode()).isEqualTo(415);
        assertThat(JSON.readTree(response.body()).path("message").asText()).isNotBlank();
        assertThat(list().path("totalItems").asInt()).isZero();
    }

    byte[] paddedCsv(int size) {
        var header = (HEADER.stripTrailing() + ",note\n").getBytes(StandardCharsets.UTF_8);
        var record = (row("21", TIME).stripTrailing() + "," + "x".repeat(256) + "\n").getBytes(StandardCharsets.UTF_8);
        var bytes = new byte[size];
        Arrays.fill(bytes, (byte) '\n');
        System.arraycopy(header, 0, bytes, 0, header.length);
        int offset = header.length;
        while (offset + record.length <= size) {
            System.arraycopy(record, 0, bytes, offset, record.length);
            offset += record.length;
        }
        return bytes;
    }

    HttpResponse<String> send(byte[] file, String filename, String contentType) throws Exception {
        var output = new ByteArrayOutputStream();
        output.write(
                ("--reading-import-boundary\r\nContent-Disposition: form-data; name=\"options\"\r\nContent-Type: application/json\r\n\r\n"
                                + JSON.writeValueAsString(options(UUID.randomUUID()))
                                + "\r\n--reading-import-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\""
                                + filename
                                + "\"\r\nContent-Type: " + contentType + "\r\n\r\n")
                        .getBytes(StandardCharsets.UTF_8));
        output.write(file);
        output.write("\r\n--reading-import-boundary--\r\n".getBytes(StandardCharsets.US_ASCII));
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + imports()))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer import-test-token")
                .header("Content-Type", "multipart/form-data; boundary=reading-import-boundary")
                .POST(HttpRequest.BodyPublishers.ofByteArray(output.toByteArray()))
                .build();
        try (var client = HttpClient.newHttpClient()) {
            return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        }
    }
}
