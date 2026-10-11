package com.proj.server.asset;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.catalogue.CatalogueRepository;
import com.proj.server.config.SecurityConfig;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.location.LocationRepository;
import com.proj.server.location.LocationResponse;
import com.proj.server.location.LocationType;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(
        controllers = AssetController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, AssetService.class, AssetExceptionHandler.class})
class AssetControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    AssetRepository repository;

    @MockitoBean
    LocationRepository locations;

    @MockitoBean
    EstateRepository estates;

    @MockitoBean
    CatalogueRepository catalogue;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID estateId = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");
    private final UUID assetId = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private final UUID blockId = UUID.fromString("00000000-0000-0000-0000-00000000000b");
    private final UUID levelId = UUID.fromString("00000000-0000-0000-0000-00000000000c");
    private final UUID lobbyId = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private final UUID plantRoomId = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
    private final UUID foreignId = UUID.fromString("00000000-0000-0000-0000-0000000000ff");
    private final UUID manufacturerId = UUID.fromString("00000000-0000-0000-0000-0000000000d1");
    private final UUID modelId = UUID.fromString("00000000-0000-0000-0000-0000000000d2");
    private final OffsetDateTime now = OffsetDateTime.parse("2026-09-27T00:00:00Z");
    private final String base = "/estates/" + estateId + "/assets";
    private final String one = base + "/" + assetId;

    private EstateResponse estate(OffsetDateTime deactivatedAt) {
        return new EstateResponse(
                estateId, "Sunrise Court", "SUNRISE", "1 Sunrise Road", "123456", null, now, now, deactivatedAt, true);
    }

    private LocationResponse location(
            UUID id, LocationType type, UUID parentId, String name, OffsetDateTime deactivatedAt) {
        return new LocationResponse(id, type, parentId, name, null, now, now, deactivatedAt);
    }

    private AssetRecord asset(UUID locationId, OffsetDateTime deactivatedAt) {
        return new AssetRecord(
                assetId,
                estateId,
                locationId,
                "SUNRISE-A0001",
                "Lift 1",
                "LIFT",
                LocalDate.parse("2020-05-01"),
                "SN-1",
                now,
                now,
                deactivatedAt,
                0,
                null,
                null,
                manufacturerId,
                modelId);
    }

    @BeforeEach
    void setup() {
        when(catalogue.manufacturerName(manufacturerId)).thenReturn("Otis");
        when(catalogue.modelName(modelId)).thenReturn("Gen2");
        // The seeded AssetCategory rows these tests use; any other code (e.g. ROCKET) is unknown.
        when(catalogue.categoryExists("LIFT")).thenReturn(true);
        when(catalogue.categoryExists("PUMP")).thenReturn(true);
        when(estates.findOwned(estateId, "owner", false)).thenReturn(Optional.of(estate(null)));
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(null)));
        when(locations.find(blockId, estateId))
                .thenReturn(Optional.of(location(blockId, LocationType.BLOCK, null, "Blk 101", null)));
        when(locations.find(levelId, estateId))
                .thenReturn(Optional.of(location(levelId, LocationType.LEVEL, blockId, "Level 1", null)));
        when(locations.find(lobbyId, estateId))
                .thenReturn(Optional.of(location(lobbyId, LocationType.COMMON_AREA, levelId, "Lift lobby", null)));
        when(locations.find(plantRoomId, estateId))
                .thenReturn(Optional.of(location(plantRoomId, LocationType.COMMON_AREA, blockId, "Plant room", null)));
        when(repository.find(assetId, estateId, false)).thenReturn(Optional.of(asset(lobbyId, null)));
        when(repository.find(assetId, estateId, true)).thenReturn(Optional.of(asset(lobbyId, null)));
    }

    private static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(t -> t.subject(subject)));
    }

    private static MockHttpServletRequestBuilder as(
            String subject, MockHttpServletRequestBuilder request, String json) {
        return as(subject, request).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private static MockHttpServletRequestBuilder asOwner(MockHttpServletRequestBuilder request, String json) {
        return as("owner", request, json);
    }

    private static String body(UUID locationId) {
        return """
                {"name":"Lift 1","category":"LIFT","locationId":"%s","installedOn":"2020-05-01",\
                "manufacturer":"Otis","model":"Gen2","serialNumber":"SN-1"}""".formatted(locationId);
    }

    private static String deactivation(String reference) {
        return "{\"reference\":\"" + reference
                + "\",\"retiredOn\":\"2025-01-01\",\"retirementReason\":\"Worn out\",\"expectedVersion\":0}";
    }

    /** Echoes the create request back as the stored row, as the database would. */
    private void createEchoesTheRequest() {
        when(repository.create(eq(estateId), anyString(), any())).thenAnswer(call -> {
            String reference = call.getArgument(1);
            CreateAssetRequest request = call.getArgument(2);
            return new AssetRecord(
                    assetId,
                    estateId,
                    request.locationId(),
                    reference,
                    request.name(),
                    request.category(),
                    request.installedOn(),
                    request.serialNumber(),
                    now,
                    now,
                    null,
                    0,
                    null,
                    null,
                    null,
                    null);
        });
    }

    // --- Access ---

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get(one)).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsATokenWithoutASubjectOnEveryEndpoint() throws Exception {
        var noSubject = jwt().jwt(t -> t.claims(claims -> claims.remove("sub")));
        mvc.perform(post(base)
                        .with(noSubject)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(lobbyId)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(one).with(noSubject)).andExpect(status().isUnauthorized());
        mvc.perform(patch(one)
                        .with(noSubject)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(lobbyId)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(one + "/deactivate")
                        .with(noSubject)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(deactivation("SUNRISE-A0001")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void hidesAssetsOfEstatesOwnedBySomeoneElse() throws Exception {
        mvc.perform(as("other", post(base), body(lobbyId))).andExpect(status().isNotFound());
        mvc.perform(as("other", get(one))).andExpect(status().isNotFound());
        mvc.perform(as("other", patch(one), body(lobbyId))).andExpect(status().isNotFound());
        mvc.perform(as("other", post(one + "/deactivate"), deactivation("SUNRISE-A0001")))
                .andExpect(status().isNotFound());
        verify(repository, never()).create(any(), any(), any());
        verify(repository, never()).update(any(), any());
        verify(repository, never()).transition(any(), any(), any(), any(), any());
    }

    @Test
    void rejectsChangesInAnInactiveEstate() throws Exception {
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(now)));
        mvc.perform(asOwner(post(base), body(lobbyId))).andExpect(status().isConflict());
        mvc.perform(asOwner(patch(one), body(lobbyId))).andExpect(status().isConflict());
        mvc.perform(asOwner(post(one + "/deactivate"), deactivation("SUNRISE-A0001")))
                .andExpect(status().isConflict());
        verify(repository, never()).create(any(), any(), any());
        verify(repository, never()).update(any(), any());
        verify(repository, never()).transition(any(), any(), any(), any(), any());
    }

    // --- Create ---

    @Test
    void assignsSequentialReferencesFromTheEstateCode() throws Exception {
        when(repository.count(estateId)).thenReturn(0, 1);
        createEchoesTheRequest();
        mvc.perform(asOwner(post(base), body(lobbyId)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", one))
                .andExpect(jsonPath("$.reference").value("SUNRISE-A0001"))
                .andExpect(jsonPath("$.estateId").value(estateId.toString()))
                .andExpect(jsonPath("$.category").value("LIFT"))
                .andExpect(jsonPath("$.locationId").value(lobbyId.toString()))
                .andExpect(jsonPath("$.locationPath").value("Blk 101 › Level 1 › Lift lobby"))
                .andExpect(jsonPath("$.installedOn").value("2020-05-01"));
        mvc.perform(asOwner(post(base), body(lobbyId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reference").value("SUNRISE-A0002"));
    }

    @Test
    void countsExistingAssetsOnlyWhileHoldingTheEstateLock() throws Exception {
        createEchoesTheRequest();
        mvc.perform(asOwner(post(base), body(lobbyId))).andExpect(status().isCreated());
        var order = inOrder(estates, repository);
        order.verify(estates).findOwned(estateId, "owner", true);
        order.verify(repository).count(estateId);
    }

    @Test
    void trimsTextAndStoresBlankOptionalFieldsAsNull() throws Exception {
        createEchoesTheRequest();
        var json = """
                {"name":"  Lift 1  ","category":"LIFT","locationId":"%s","manufacturer":"   ","serialNumber":" SN-1 "}""".formatted(lobbyId);
        mvc.perform(asOwner(post(base), json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Lift 1"))
                .andExpect(jsonPath("$.serialNumber").value("SN-1"))
                .andExpect(jsonPath("$.installedOn").isEmpty())
                .andExpect(jsonPath("$.manufacturer").isEmpty())
                .andExpect(jsonPath("$.model").isEmpty())
                .andExpect(jsonPath("$.deactivatedAt").isEmpty());
        verify(repository)
                .create(
                        estateId,
                        "SUNRISE-A0001",
                        new CreateAssetRequest("Lift 1", "LIFT", lobbyId, null, null, null, "SN-1"));
    }

    @ParameterizedTest(name = "rejects {0}")
    @ValueSource(
            strings = {
                "{\"name\":\"   \",\"category\":\"LIFT\",\"locationId\":\"00000000-0000-0000-0000-00000000000a\"}",
                "{\"category\":\"LIFT\",\"locationId\":\"00000000-0000-0000-0000-00000000000a\"}",
                "{\"name\":\"Lift 1\",\"locationId\":\"00000000-0000-0000-0000-00000000000a\"}",
                "{\"name\":\"Lift 1\",\"category\":\"ROCKET\",\"locationId\":\"00000000-0000-0000-0000-00000000000a\"}",
                "{\"name\":\"Lift 1\",\"category\":\"LIFT\"}",
            })
    void rejectsAMissingNameCategoryOrLocation(String json) throws Exception {
        mvc.perform(asOwner(post(base), json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsALocationFromAnotherEstate() throws Exception {
        mvc.perform(asOwner(post(base), body(foreignId))).andExpect(status().isNotFound());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsAnInactiveLocation() throws Exception {
        when(locations.find(lobbyId, estateId))
                .thenReturn(Optional.of(location(lobbyId, LocationType.COMMON_AREA, levelId, "Lift lobby", now)));
        mvc.perform(asOwner(post(base), body(lobbyId))).andExpect(status().isConflict());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void reportsDatabaseConstraintViolationsAsConflictsWithoutSql() throws Exception {
        when(repository.create(any(), any(), any())).thenThrow(new DataIntegrityViolationException("sensitive SQL"));
        mvc.perform(asOwner(post(base), body(lobbyId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(not(containsString("SQL"))));
    }

    // --- Read ---

    @Test
    void readsAnAssetWithItsFullLocationPath() throws Exception {
        mvc.perform(as("owner", get(one)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(assetId.toString()))
                .andExpect(jsonPath("$.reference").value("SUNRISE-A0001"))
                .andExpect(jsonPath("$.locationPath").value("Blk 101 › Level 1 › Lift lobby"))
                .andExpect(jsonPath("$.manufacturer").value("Otis"));
    }

    @Test
    void treatsAnUnknownAssetAsMissing() throws Exception {
        mvc.perform(as("owner", get(base + "/" + foreignId))).andExpect(status().isNotFound());
        mvc.perform(asOwner(patch(base + "/" + foreignId), body(lobbyId))).andExpect(status().isNotFound());
        mvc.perform(asOwner(post(base + "/" + foreignId + "/deactivate"), deactivation("SUNRISE-A0001")))
                .andExpect(status().isNotFound());
    }

    // --- Update ---

    @Test
    void updatesTheFieldsAndMovesTheAssetButNeverTheReference() throws Exception {
        var moved = new UpdateAssetRequest(
                "Lift 1A", "PUMP", plantRoomId, LocalDate.parse("2021-01-02"), "Grundfos", null, null);
        var stored = asset(plantRoomId, null);
        stored.setName("Lift 1A");
        stored.setCategory("PUMP");
        when(repository.update(assetId, moved)).thenReturn(stored);
        var json = """
                {"reference":"HACKED-A9999","name":" Lift 1A ","category":"PUMP","locationId":"%s",\
                "installedOn":"2021-01-02","manufacturer":"Grundfos","model":"","serialNumber":null}""".formatted(plantRoomId);
        mvc.perform(asOwner(patch(one), json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reference").value("SUNRISE-A0001"))
                .andExpect(jsonPath("$.name").value("Lift 1A"))
                .andExpect(jsonPath("$.locationId").value(plantRoomId.toString()))
                .andExpect(jsonPath("$.locationPath").value("Blk 101 › Plant room"));
        verify(repository).update(assetId, moved);
    }

    @Test
    void locksTheEstateAndThenTheAssetBeforeUpdating() throws Exception {
        when(repository.update(any(), any())).thenReturn(asset(lobbyId, null));
        mvc.perform(asOwner(patch(one), body(lobbyId))).andExpect(status().isOk());
        var order = inOrder(estates, repository);
        order.verify(estates).findOwned(estateId, "owner", true);
        order.verify(repository).find(assetId, estateId, true);
        order.verify(repository).update(any(), any());
    }

    @Test
    void rejectsAnUpdateWithoutALocation() throws Exception {
        mvc.perform(asOwner(patch(one), "{\"name\":\"Lift 1\",\"category\":\"LIFT\",\"locationId\":null}"))
                .andExpect(status().isBadRequest());
        verify(repository, never()).update(any(), any());
    }

    @Test
    void rejectsMovingToALocationFromAnotherEstate() throws Exception {
        mvc.perform(asOwner(patch(one), body(foreignId))).andExpect(status().isNotFound());
        verify(repository, never()).update(any(), any());
    }

    @Test
    void rejectsMovingToAnInactiveLocation() throws Exception {
        when(locations.find(plantRoomId, estateId))
                .thenReturn(Optional.of(location(plantRoomId, LocationType.COMMON_AREA, blockId, "Plant room", now)));
        mvc.perform(asOwner(patch(one), body(plantRoomId))).andExpect(status().isConflict());
        verify(repository, never()).update(any(), any());
    }

    @Test
    void rejectsEditingADeactivatedAsset() throws Exception {
        when(repository.find(assetId, estateId, true)).thenReturn(Optional.of(asset(lobbyId, now)));
        mvc.perform(asOwner(patch(one), body(lobbyId))).andExpect(status().isConflict());
        verify(repository, never()).update(any(), any());
    }

    // --- Deactivate ---

    @Test
    void deactivatesTheAssetWhenItsExactReferenceIsTyped() throws Exception {
        when(repository.transition(any(), eq("RETIRED"), eq("owner"), any(), eq("Worn out")))
                .thenReturn(asset(lobbyId, now));
        mvc.perform(asOwner(post(one + "/deactivate"), deactivation("SUNRISE-A0001")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(assetId.toString()))
                .andExpect(jsonPath("$.deactivatedAt").isNotEmpty());
        verify(repository).find(assetId, estateId, true);
    }

    @Test
    void rejectsTheWrongReference() throws Exception {
        mvc.perform(asOwner(post(one + "/deactivate"), deactivation("sunrise-a0001")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(asOwner(post(one + "/deactivate"), "{}")).andExpect(status().isBadRequest());
        verify(repository, never()).transition(any(), any(), any(), any(), any());
    }

    @Test
    void repeatedRetirementIsRejectedWithoutChangingHistory() throws Exception {
        when(repository.find(assetId, estateId, true))
                .thenReturn(Optional.of(asset(lobbyId, OffsetDateTime.parse("2026-01-01T00:00:00Z"))));
        mvc.perform(asOwner(post(one + "/deactivate"), deactivation("SUNRISE-A0001")))
                .andExpect(status().isConflict());
        verify(repository, never()).transition(any(), any(), any(), any(), any());
    }

    @Test
    void aDeactivatedAssetStaysReadable() throws Exception {
        when(repository.find(assetId, estateId, false)).thenReturn(Optional.of(asset(lobbyId, now)));
        mvc.perform(as("owner", get(one)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedAt").isNotEmpty())
                .andExpect(jsonPath("$.locationPath").value("Blk 101 › Level 1 › Lift lobby"));
    }
}
