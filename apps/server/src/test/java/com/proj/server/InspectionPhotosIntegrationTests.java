package com.proj.server;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.ServletException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.jooq.ExecuteContext;
import org.jooq.exception.DataAccessException;
import org.jooq.impl.DefaultExecuteListener;
import org.jooq.impl.DefaultExecuteListenerProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

/** Photos are put into the in-memory storage under issued keys, as the browser's direct upload would (decision 0050). */
class InspectionPhotosIntegrationTests extends InspectionTestSupport {
    @org.springframework.beans.factory.annotation.Autowired
    com.proj.server.inspection.InspectionService inspectionService;

    @Test
    void threePrivatePhotosPersistAndAreReadableByCurrentEstateInspectorsOnly() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        member(data[0], "manager", "MANAGER");
        var request = submission(data, "FAIL", today().toString(), "  Cracked seal  ");
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
        assertEquals(3, storage.objects.size());
        storage.signed.clear();
        String photoId = JsonPath.read(body, "$.photos[0].id");
        String url = inspections(data) + "/" + id(body) + "/photos/" + photoId;
        for (String user : new String[] {OWNER, "manager", "crew"}) {
            read(url, user)
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "private, no-store"))
                    .andExpect(jsonPath("$.url").value(startsWith("memory://download/inspections/" + id(body) + "/")))
                    .andExpect(jsonPath("$.url").value(containsString("contentType=image%2Fpng")))
                    .andExpect(jsonPath("$.expiresAt").isNotEmpty());
        }
        assertEquals(3, storage.signed.size());
        String key = storage.signed.getFirst();
        var decoded =
                ImageIO.read(new ByteArrayInputStream(storage.objects.get(key).bytes()));
        assertNotNull(decoded);
        assertEquals(2, decoded.getWidth());
        member(data[0], "resident", "RESIDENT");
        storage.signed.clear();
        read(url, "resident").andExpect(status().isForbidden());
        read(url, "stranger").andExpect(status().isNotFound());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='crew'", data[0]);
        read(url, "crew").andExpect(status().isNotFound());
        assertTrue(storage.signed.isEmpty(), "refused readers never get a link");
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

    @Test
    void aPhotoSlotIsATenMinuteSignedUploadForInspectorsOnly() throws Exception {
        var data = asset();
        member(data[0], "resident", "RESIDENT");
        var slot = mvc.perform(slot(data, null, "image/png", 1000).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.maxBytes").value(5 * 1024 * 1024))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String inspectionId = JsonPath.read(slot, "$.inspectionId");
        String key = JsonPath.read(slot, "$.objectKey");
        assertTrue(key.startsWith("inspections/" + inspectionId + "/"));
        assertTrue(JsonPath.<String>read(slot, "$.uploadUrl").startsWith("memory://upload/" + key));
        var minutes = Duration.between(Instant.now(), Instant.parse(JsonPath.read(slot, "$.expiresAt")))
                .toMinutes();
        assertTrue(minutes >= 9 && minutes <= 10);
        var second = mvc.perform(slot(data, UUID.fromString(inspectionId), "image/jpeg", 1000)
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertEquals(inspectionId, JsonPath.read(second, "$.inspectionId"));

        storage.signed.clear();
        mvc.perform(slot(data, null, "image/png", 1000).with(jwt().jwt(t -> t.subject("resident"))))
                .andExpect(status().isForbidden());
        mvc.perform(slot(data, null, "image/png", 1000).with(jwt().jwt(t -> t.subject("stranger"))))
                .andExpect(status().isNotFound());
        assertTrue(storage.signed.isEmpty());
        mvc.perform(slot(data, null, "image/gif", 1000).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(slot(data, null, "image/png", 5 * 1024 * 1024 + 1).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isPayloadTooLarge());
        storage.unavailable = true;
        mvc.perform(slot(data, null, "image/png", 1000).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("File storage is temporarily unavailable. Try again later."));
    }

    @ParameterizedTest
    @CsvSource({"4033,1", "1,3025"})
    void oversizedDimensionsAreRejectedAndThePhotoDeleted(int width, int height) throws Exception {
        var data = asset();
        mvc.perform(submission(data, "PASS", today().toString())
                        .file(photo("png", width, height))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertTrue(storage.objects.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void aFourthPhotoIsRefusedAndFilesOverFiveMegabytesAreDeleted() throws Exception {
        var data = asset();
        var request = submission(data, "PASS", today().toString());
        for (int i = 0; i < 4; i++) request.file(photo("png", 1, 1));
        mvc.perform(request.with(jwt().jwt(t -> t.subject(OWNER)))).andExpect(status().isBadRequest());
        storage.reset();
        mvc.perform(submission(data, "PASS", today().toString())
                        .file(new MockMultipartFile("photos", "large.png", "image/png", new byte[5 * 1024 * 1024 + 1]))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isPayloadTooLarge());
        assertTrue(storage.objects.isEmpty());
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
        assertEquals(1, storage.objects.size());
    }

    @ParameterizedTest
    @ValueSource(strings = {"text", "empty", "mismatched", "unsupported", "truncated"})
    void serverValidatesContentRatherThanTrustingTheDeclaredType(String invalid) throws Exception {
        var data = asset();
        byte[] bytes = switch (invalid) {
            case "empty" -> new byte[0];
            case "mismatched" -> photo("jpeg", 1, 1).getBytes();
            case "truncated" -> Arrays.copyOf(photo("png", 1, 1).getBytes(), 24);
            default -> "not an image".getBytes(StandardCharsets.UTF_8);
        };
        mvc.perform(submission(data, "FAIL", today().toString())
                        .file(invalid.equals("unsupported") ? "image/gif" : "image/png", bytes)
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().is(invalid.equals("unsupported") ? 415 : 400));
        assertTrue(storage.objects.isEmpty(), "a photo that fails its checks is deleted");
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void keysNotIssuedForThisInspectionAreRefusedAndLeftAlone() throws Exception {
        var data = asset();
        String foreign = "inspections/" + UUID.randomUUID() + "/" + UUID.randomUUID();
        storage.upload(foreign, photo("png", 1, 1).getBytes(), "image/png");
        var body = "{\"inspectionId\":\"" + UUID.randomUUID() + "\",\"outcome\":\"PASS\",\"inspectedOn\":\"" + today()
                + "\",\"expectedLocationId\":\"" + data[1] + "\",\"photoKeys\":[\"" + foreign + "\"]}";
        mvc.perform(post(inspections(data))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertTrue(storage.objects.containsKey(foreign));
        mvc.perform(submission(data, "PASS", today().toString()).missingFile().with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void authorizationIsCheckedBeforeStorageIsTouched() throws Exception {
        var data = asset();
        member(data[0], "resident", "RESIDENT");
        var request = submission(data, "FAIL", today().toString()).file(photo("png", 1, 1));
        mvc.perform(request.with(jwt().jwt(t -> t.subject("resident")))).andExpect(status().isForbidden());
        assertTrue(storage.objects.containsKey(request.keys().getFirst()), "left for the hourly sweep");
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void unavailableStorageDoesNotBlockPhotoFreeResults() throws Exception {
        var data = asset();
        var request = submission(data, "FAIL", today().toString()).file(photo("png", 1, 1));
        storage.unavailable = true;
        mvc.perform(request.with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("File storage is temporarily unavailable. Try again later."));
        save(data, OWNER, "PASS").andExpect(status().isCreated());
        assertEquals(1, count("AssetInspectionResult", data[0]));
    }

    @Test
    void failedDatabasePersistenceDeletesUploadedEvidenceWithoutReportingSuccess() throws Exception {
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
        assertTrue(storage.objects.isEmpty());
        assertEquals(0, count("AssetInspectionResult", data[0]));
        assertEquals(0, count("AssetInspectionPhoto", data[0]));
    }

    @ParameterizedTest
    @ValueSource(strings = {"estate", "membership", "asset"})
    void stateChangesAfterUploadAreCheckedBeforeAnythingIsSaved(String change) throws Exception {
        var data = asset();
        member(data[0], "uploading-crew", "CREW");
        var request = submission(data, "FAIL", today().toString()).file(photo("png", 1, 1));
        switch (change) {
            case "estate" -> db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
            case "asset" ->
                db.execute(
                        "update \"Asset\" set \"deactivatedAt\"=now(),\"retiredOn\"=current_date,\"retirementReason\"='Retired' where id=?",
                        data[2]);
            case "membership" ->
                db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='uploading-crew'", data[0]);
            default -> throw new IllegalArgumentException(change);
        }
        mvc.perform(request.with(jwt().jwt(t -> t.subject("uploading-crew"))))
                .andExpect(status().is(change.equals("membership") ? 404 : 409));
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void theSweepDeletesOnlyUnsavedPhotosOlderThanADay() throws Exception {
        var data = asset();
        String body = upload(data);
        String kept = db.fetchValue(
                        "select \"storageKey\" from \"AssetInspectionPhoto\" where \"inspectionResultId\"=?",
                        UUID.fromString(id(body)))
                .toString();
        String old = "inspections/" + UUID.randomUUID() + "/" + UUID.randomUUID();
        String fresh = "inspections/" + UUID.randomUUID() + "/" + UUID.randomUUID();
        storage.upload(old, new byte[] {1}, "image/png");
        storage.upload(fresh, new byte[] {1}, "image/png");
        var yesterday = Instant.now().minus(Duration.ofHours(25));
        storage.age(old, yesterday);
        storage.age(kept, yesterday);

        inspectionService.cleanupOrphans();

        assertFalse(storage.objects.containsKey(old));
        assertTrue(storage.objects.containsKey(fresh));
        assertTrue(storage.objects.containsKey(kept));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder slot(
            UUID[] data, UUID inspectionId, String type, long size) {
        var body = "{" + (inspectionId == null ? "" : "\"inspectionId\":\"" + inspectionId + "\",")
                + "\"contentType\":\"" + type + "\",\"size\":" + size + "}";
        return post(inspections(data) + "/photo-slots")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
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
}
