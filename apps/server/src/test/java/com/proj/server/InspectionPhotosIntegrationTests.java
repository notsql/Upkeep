package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.ServletException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.jooq.ExecuteContext;
import org.jooq.exception.DataAccessException;
import org.jooq.impl.DefaultExecuteListener;
import org.jooq.impl.DefaultExecuteListenerProvider;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** A local S3 HTTP boundary avoids choosing an inspection storage class before implementation. */
class InspectionPhotosIntegrationTests extends InspectionTestSupport {
    private static final Map<String, byte[]> OBJECTS = new ConcurrentHashMap<>();
    private static HttpServer storage;
    private static volatile int acceptedUploads;
    private static volatile int failAfter;
    private static volatile CountDownLatch uploaded;
    private static volatile CountDownLatch finishUpload;
    private static volatile boolean rejectDeletes;

    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry properties) throws IOException {
        storage = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        storage.createContext("/", InspectionPhotosIntegrationTests::objectRequest);
        storage.start();
        properties.add(
                "app.r2.endpoint",
                () -> "http://127.0.0.1:" + storage.getAddress().getPort());
        properties.add("app.r2.access-id", () -> "test-access");
        properties.add("app.r2.secret-access-key", () -> "test-secret");
        properties.add("app.r2.bucket-name", () -> "inspection-tests");
    }

    @BeforeEach
    void resetStorage() {
        OBJECTS.clear();
        acceptedUploads = 0;
        failAfter = Integer.MAX_VALUE;
        uploaded = null;
        finishUpload = null;
        rejectDeletes = false;
    }

    @AfterAll
    static void stopStorage() {
        if (storage != null) storage.stop(0);
    }

    @Test
    void threePrivatePhotosPersistAndAreReadableByCurrentEstateInspectorsOnly() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        member(data[0], "manager", "MANAGER");
        var request = submission(data, "FAIL", today().toString()).param("notes", "  Cracked seal  ");
        for (int i = 0; i < 3; i++) request.file(photo("png", 2, 2));
        String body = mvc.perform(request.with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.notes").value("Cracked seal"))
                .andExpect(jsonPath("$.photos.length()").value(3))
                .andExpect(jsonPath("$.photos[0].contentType").value("image/png"))
                .andExpect(jsonPath("$.photos[0].storageKey").doesNotExist())
                .andExpect(jsonPath("$.photos[0].url").doesNotExist())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertEquals(3, OBJECTS.size());
        String photoId = JsonPath.read(body, "$.photos[0].id");
        String url = inspections(data) + "/" + id(body) + "/photos/" + photoId;
        for (String user : new String[] {OWNER, "manager", "crew"}) {
            var image = read(url, user)
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "private, no-store"))
                    .andExpect(content().contentType("image/png"))
                    .andReturn()
                    .getResponse()
                    .getContentAsByteArray();
            var decoded = ImageIO.read(new ByteArrayInputStream(image));
            assertNotNull(decoded);
            assertEquals(2, decoded.getWidth());
        }
        member(data[0], "resident", "RESIDENT");
        read(url, "resident").andExpect(status().isForbidden());
        read(url, "stranger").andExpect(status().isNotFound());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='crew'", data[0]);
        read(url, "crew").andExpect(status().isNotFound());
        db.execute(
                "update \"Asset\" set \"deactivatedAt\"=now(),\"retiredOn\"=current_date,\"retirementReason\"='Retired' where id=?",
                data[2]);
        read(url, OWNER).andExpect(status().isOk());
    }

    @Test
    void photoIdsMustMatchTheEntireEstateAssetAndInspectionPath() throws Exception {
        var data = asset();
        member(data[0], OWNER, "MANAGER");
        String body = upload(data);
        String photoId = JsonPath.read(body, "$.photos[0].id");
        String inspectionId = id(body);
        String anotherInspection = id(saved(data, "PASS"));
        var foreign = asset();
        for (String url : new String[] {
            inspections(foreign) + "/" + inspectionId + "/photos/" + photoId,
            inspections(data) + "/" + anotherInspection + "/photos/" + photoId,
            inspections(data) + "/" + inspectionId + "/photos/" + UUID.randomUUID(),
            "/resident/reports/" + inspectionId + "/images/" + photoId,
            "/estates/" + data[0] + "/reports/" + inspectionId + "/images/" + photoId
        }) read(url, OWNER).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @CsvSource({"png,4032,3024", "jpeg,2,2"})
    void validContentAndTheMaximumDimensionsAreAccepted(String format, int width, int height) throws Exception {
        var data = asset();
        mvc.perform(submission(data, "PASS", today().toString())
                        .file(photo(format, width, height))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photos[0].contentType").value("image/" + format));
    }

    @ParameterizedTest
    @CsvSource({"4033,1", "1,3025"})
    void oversizedDimensionsAreRejectedBeforeUploading(int width, int height) throws Exception {
        var data = asset();
        mvc.perform(submission(data, "PASS", today().toString())
                        .file(photo("png", width, height))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertTrue(OBJECTS.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void aFourthPhotoAndFilesOverFiveMegabytesAreRejectedBeforeUploading() throws Exception {
        var data = asset();
        var request = submission(data, "PASS", today().toString());
        for (int i = 0; i < 4; i++) request.file(photo("png", 1, 1));
        mvc.perform(request.with(jwt().jwt(t -> t.subject(OWNER)))).andExpect(status().isBadRequest());
        mvc.perform(submission(data, "PASS", today().toString())
                        .file(new MockMultipartFile("photos", "large.png", "image/png", new byte[5 * 1024 * 1024 + 1]))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isPayloadTooLarge());
        assertTrue(OBJECTS.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void aValidImageAtExactlyFiveMegabytesIsAccepted() throws Exception {
        var data = asset();
        byte[] bytes = Arrays.copyOf(photo("png", 1, 1).getBytes(), 5 * 1024 * 1024);
        mvc.perform(submission(data, "PASS", today().toString())
                        .file(new MockMultipartFile("photos", "exact-limit.png", "image/png", bytes))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated());
        assertEquals(1, OBJECTS.size());
    }

    @ParameterizedTest
    @ValueSource(strings = {"text", "empty", "mismatched", "unsupported", "truncated"})
    void serverValidatesContentRatherThanTrustingFilenameOrMimeType(String invalid) throws Exception {
        var data = asset();
        byte[] bytes =
                switch (invalid) {
                    case "empty" -> new byte[0];
                    case "mismatched" -> photo("jpeg", 1, 1).getBytes();
                    case "truncated" -> Arrays.copyOf(photo("png", 1, 1).getBytes(), 24);
                    default -> "not an image".getBytes(StandardCharsets.UTF_8);
                };
        mvc.perform(submission(data, "FAIL", today().toString())
                        .file(new MockMultipartFile(
                                "photos",
                                "pretend.png",
                                invalid.equals("unsupported") ? "image/gif" : "image/png",
                                bytes))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().is(invalid.equals("unsupported") ? 415 : 400));
        assertTrue(OBJECTS.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void authorizationIsCheckedBeforeUploadingEvidence() throws Exception {
        var data = asset();
        member(data[0], "resident", "RESIDENT");
        mvc.perform(submission(data, "FAIL", today().toString())
                        .file(photo("png", 1, 1))
                        .with(jwt().jwt(t -> t.subject("resident"))))
                .andExpect(status().isForbidden());
        assertTrue(OBJECTS.isEmpty());
    }

    @Test
    void laterUploadFailureCleansUpEarlierObjectsAndLeavesNoSubmittedResult() throws Exception {
        var data = asset();
        failAfter = 1;
        mvc.perform(submission(data, "FAIL", today().toString())
                        .file(photo("png", 1, 1))
                        .file(photo("png", 1, 1))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isServiceUnavailable());
        assertTrue(OBJECTS.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
        assertEquals(0, count("AssetInspectionPhoto", data[0]));
    }

    @Test
    void unavailableStorageDoesNotBlockPhotoFreeResultsOrExposeProviderErrors() throws Exception {
        var data = asset();
        failAfter = 0;
        var error = mvc.perform(submission(data, "FAIL", today().toString())
                        .file(photo("png", 1, 1))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertFalse(error.contains("private-provider-detail"));
        save(data, OWNER, "PASS").andExpect(status().isCreated());
        assertEquals(1, count("AssetInspectionResult", data[0]));
    }

    @Test
    void failedDatabasePersistenceCleansUpUploadedEvidenceWithoutReportingSuccess() throws Exception {
        var data = asset();
        var previous = db.configuration().executeListenerProviders();
        var providers = Arrays.copyOf(previous, previous.length + 1);
        providers[previous.length] = new DefaultExecuteListenerProvider(new DefaultExecuteListener() {
            @Override
            public void executeStart(ExecuteContext context) {
                String sql = context.sql();
                if (sql != null
                        && sql.toLowerCase(java.util.Locale.ROOT).startsWith("insert")
                        && sql.contains("AssetInspectionResult"))
                    throw new DataAccessException("Simulated inspection persistence failure");
            }
        });
        db.configuration().set(providers);
        try {
            try {
                mvc.perform(submission(data, "FAIL", today().toString())
                                .file(photo("png", 1, 1))
                                .with(jwt().jwt(t -> t.subject(OWNER))))
                        .andExpect(status().is5xxServerError());
            } catch (ServletException error) {
                // MockMvc may propagate an unhandled persistence exception instead of rendering a container 500.
                assertInstanceOf(DataAccessException.class, error.getCause());
            }
        } finally {
            db.configuration().set(previous);
        }
        assertEquals(1, acceptedUploads);
        assertTrue(OBJECTS.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
        assertEquals(0, count("AssetInspectionPhoto", data[0]));
    }

    @Test
    void cleanupFailureStillReportsFailureAndLeavesNoSubmittedDatabaseRecord() throws Exception {
        var data = asset();
        failAfter = 1;
        rejectDeletes = true;
        var body = mvc.perform(submission(data, "FAIL", today().toString())
                        .file(photo("png", 1, 1))
                        .file(photo("png", 1, 1))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isServiceUnavailable())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertFalse(body.contains("private-provider-detail"));
        assertEquals(1, OBJECTS.size());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @ParameterizedTest
    @ValueSource(strings = {"estate", "membership", "asset"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void stateChangesDuringUploadAreRecheckedBeforePersistenceAndEvidenceIsCleanedUp(String change) throws Exception {
        var data = asset();
        uploaded = new CountDownLatch(1);
        finishUpload = new CountDownLatch(1);
        try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
            member(data[0], "uploading-crew", "CREW");
            var pending = requests.submit(() -> mvc.perform(submission(data, "FAIL", today().toString())
                            .file(photo("png", 1, 1))
                            .with(jwt().jwt(t -> t.subject("uploading-crew"))))
                    .andReturn()
                    .getResponse()
                    .getStatus());
            try {
                assertTrue(uploaded.await(5, TimeUnit.SECONDS), "The photo must upload before the state mutation");
                db.transaction(configuration -> {
                    var mutation = org.jooq.impl.DSL.using(configuration);
                    mutation.execute("set local lock_timeout='5s'");
                    switch (change) {
                        case "estate" ->
                            mutation.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
                        case "asset" ->
                            mutation.execute(
                                    "update \"Asset\" set \"deactivatedAt\"=now(),\"retiredOn\"=current_date,\"retirementReason\"='Retired' where id=?",
                                    data[2]);
                        case "membership" ->
                            mutation.execute(
                                    "delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='uploading-crew'",
                                    data[0]);
                        default -> throw new IllegalArgumentException(change);
                    }
                });
            } finally {
                finishUpload.countDown();
            }
            assertEquals(change.equals("membership") ? 404 : 409, pending.get(10, TimeUnit.SECONDS));
            assertTrue(OBJECTS.isEmpty());
            assertEquals(0, count("AssetInspectionResult", data[0]));
        } finally {
            finishUpload.countDown();
            cleanup(data[0]);
        }
    }

    private String upload(UUID[] data) throws Exception {
        return mvc.perform(submission(data, "FAIL", today().toString())
                        .file(photo("png", 2, 2))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private static MockMultipartFile photo(String format, int width, int height) throws IOException {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, bytes);
        return new MockMultipartFile("photos", "inspection." + format, "image/" + format, bytes.toByteArray());
    }

    private static String etag(byte[] bytes) throws IOException {
        try {
            return java.util.HexFormat.of()
                    .formatHex(java.security.MessageDigest.getInstance("MD5").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IOException(error);
        }
    }

    private static void objectRequest(HttpExchange exchange) throws IOException {
        try (exchange) {
            String path = exchange.getRequestURI().getPath();
            switch (exchange.getRequestMethod()) {
                case "PUT" -> {
                    if (acceptedUploads >= failAfter) {
                        byte[] error =
                                "<Error><Code>ServiceUnavailable</Code><Message>private-provider-detail</Message></Error>"
                                        .getBytes(StandardCharsets.UTF_8);
                        exchange.sendResponseHeaders(503, error.length);
                        exchange.getResponseBody().write(error);
                        return;
                    }
                    byte[] bytes = exchange.getRequestBody().readAllBytes();
                    if (String.valueOf(exchange.getRequestHeaders().getFirst("Content-Encoding"))
                            .contains("aws-chunked")) {
                        var clean = new ByteArrayOutputStream();
                        int offset = 0;
                        while (offset < bytes.length) {
                            int end = offset;
                            while (end + 1 < bytes.length && !(bytes[end] == '\r' && bytes[end + 1] == '\n')) end++;
                            String size =
                                    new String(bytes, offset, end - offset, StandardCharsets.US_ASCII).split(";", 2)[0];
                            int length = Integer.parseInt(size, 16);
                            if (length == 0) break;
                            clean.write(bytes, end + 2, length);
                            offset = end + 2 + length + 2;
                        }
                        bytes = clean.toByteArray();
                    }
                    OBJECTS.put(path, bytes);
                    acceptedUploads++;
                    if (uploaded != null) uploaded.countDown();
                    if (finishUpload != null) {
                        try {
                            if (!finishUpload.await(15, TimeUnit.SECONDS))
                                throw new IOException("Upload was not released");
                        } catch (InterruptedException error) {
                            Thread.currentThread().interrupt();
                            throw new IOException(error);
                        }
                    }
                    exchange.getResponseHeaders().set("ETag", "\"" + etag(bytes) + "\"");
                    exchange.sendResponseHeaders(200, -1);
                }
                case "GET" -> {
                    byte[] bytes = OBJECTS.get(path);
                    if (bytes == null) exchange.sendResponseHeaders(404, -1);
                    else {
                        exchange.sendResponseHeaders(200, bytes.length);
                        exchange.getResponseBody().write(bytes);
                    }
                }
                case "DELETE" -> {
                    if (rejectDeletes) {
                        exchange.sendResponseHeaders(503, -1);
                        return;
                    }
                    OBJECTS.remove(path);
                    exchange.sendResponseHeaders(204, -1);
                }
                default -> exchange.sendResponseHeaders(405, -1);
            }
        }
    }
}
