package com.proj.server.device;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.asset.AssetRepository;
import com.proj.server.config.ClockConfig;
import com.proj.server.config.SecurityConfig;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.DeviceRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.location.LocationRepository;
import com.proj.server.location.LocationResponse;
import com.proj.server.location.LocationType;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(
        controllers = DeviceController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, ClockConfig.class, DeviceService.class, DeviceExceptionHandler.class})
class DeviceControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    DeviceRepository repository;

    @MockitoBean
    AssetRepository assets;

    @MockitoBean
    LocationRepository locations;

    @MockitoBean
    EstateRepository estates;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID estateId = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");
    private final UUID assetId = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private final UUID deviceId = UUID.fromString("00000000-0000-0000-0000-0000000000d1");
    private final UUID plantRoomId = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
    private final UUID pipeRunId = UUID.fromString("00000000-0000-0000-0000-0000000000ab");
    private final UUID closedRoomId = UUID.fromString("00000000-0000-0000-0000-0000000000ac");
    private final UUID foreignId = UUID.fromString("00000000-0000-0000-0000-0000000000ff");
    private final OffsetDateTime now = OffsetDateTime.parse("2026-09-28T00:00:00Z");
    private final String base = "/estates/" + estateId + "/assets/" + assetId + "/devices";

    private EstateResponse estate(OffsetDateTime deactivatedAt) {
        return new EstateResponse(
                estateId, "Sunrise Court", "SUNRISE", "1 Sunrise Road", "123456", null, now, now, deactivatedAt, true);
    }

    private LocationResponse location(UUID id, String name, OffsetDateTime deactivatedAt) {
        return new LocationResponse(id, LocationType.COMMON_AREA, null, name, null, now, now, deactivatedAt);
    }

    private AssetRecord asset(OffsetDateTime deactivatedAt) {
        return new AssetRecord(
                assetId,
                estateId,
                plantRoomId,
                "SUNRISE-A0001",
                "Booster pump",
                "PUMP",
                LocalDate.parse("2020-05-01"),
                null,
                now,
                now,
                deactivatedAt,
                0,
                null,
                null,
                null,
                null);
    }

    private DeviceRecord device(String identifier, UUID locationId, String... metrics) {
        return new DeviceRecord(
                deviceId,
                estateId,
                assetId,
                locationId,
                identifier,
                "PT-100",
                metrics,
                60,
                null,
                now,
                now,
                null,
                null,
                null,
                null);
    }

    @BeforeEach
    void setup() {
        when(estates.findManaged(estateId, "owner")).thenReturn(Optional.of(estate(null)));
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(null)));
        when(assets.find(assetId, estateId, false)).thenReturn(Optional.of(asset(null)));
        when(assets.find(assetId, estateId, true)).thenReturn(Optional.of(asset(null)));
        when(locations.find(plantRoomId, estateId)).thenReturn(Optional.of(location(plantRoomId, "Plant room", null)));
        when(locations.find(pipeRunId, estateId)).thenReturn(Optional.of(location(pipeRunId, "Pipe run", null)));
        when(locations.find(closedRoomId, estateId))
                .thenReturn(Optional.of(location(closedRoomId, "Old plant room", now)));
    }

    private static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(t -> t.subject(subject)));
    }

    private MockHttpServletRequestBuilder register(String json) {
        return as("owner", post(base)).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private static String body(UUID locationId) {
        return """
                {"identifier":" PUMP-01 ","model":" PT-100 ","locationId":"%s",\
                "metrics":["PRESSURE","TEMPERATURE","PRESSURE"],"reportingIntervalSeconds":60}""".formatted(locationId);
    }

    /** Echoes the create request back as the stored row, as the database would. */
    private void createEchoesTheRequest() {
        when(repository.create(eq(estateId), eq(assetId), any())).thenAnswer(call -> {
            CreateDeviceRequest request = call.getArgument(2);
            return new DeviceRecord(
                    deviceId,
                    estateId,
                    assetId,
                    request.locationId(),
                    request.identifier(),
                    request.model(),
                    request.metrics().stream().map(Enum::name).toArray(String[]::new),
                    request.reportingIntervalSeconds(),
                    null,
                    now,
                    now,
                    null,
                    null,
                    null,
                    null);
        });
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(post(base).contentType(MediaType.APPLICATION_JSON).content(body(plantRoomId)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registersADeviceAwaitingItsFirstReading() throws Exception {
        createEchoesTheRequest();
        mvc.perform(register(body(plantRoomId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.identifier").value("PUMP-01"))
                .andExpect(jsonPath("$.model").value("PT-100"))
                .andExpect(jsonPath("$.assetId").value(assetId.toString()))
                .andExpect(jsonPath("$.locationId").value(plantRoomId.toString()))
                .andExpect(jsonPath("$.reportingIntervalSeconds").value(60))
                .andExpect(jsonPath("$.lastSeenAt").value(nullValue()))
                // Duplicates collapsed, catalogue order, each with its unit.
                .andExpect(jsonPath("$.metrics.length()").value(2))
                .andExpect(jsonPath("$.metrics[0].metric").value("TEMPERATURE"))
                .andExpect(jsonPath("$.metrics[0].unit").value("°C"))
                .andExpect(jsonPath("$.metrics[1].metric").value("PRESSURE"))
                .andExpect(jsonPath("$.metrics[1].unit").value("bar"));
    }

    @Test
    void acceptsAnyActiveLocationInTheAssetsEstate() throws Exception {
        createEchoesTheRequest();
        mvc.perform(register(body(pipeRunId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.locationId").value(pipeRunId.toString()));
    }

    @Test
    void rejectsALocationFromAnotherEstate() throws Exception {
        mvc.perform(register(body(foreignId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Location not found."));
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsADeactivatedLocation() throws Exception {
        mvc.perform(register(body(closedRoomId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("The chosen location is deactivated."));
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsADuplicateIdentifierWithAnExplanation() throws Exception {
        when(repository.identifierTaken("PUMP-01")).thenReturn(true);
        mvc.perform(register(body(plantRoomId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("A device with identifier \"PUMP-01\" is already registered. "
                                + "Check the identifier on the device's label."));
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void reportsARegistrationRaceOnTheIdentifierAsAConflict() throws Exception {
        when(repository.create(any(), any(), any())).thenThrow(new DuplicateKeyException("Device_identifier_key"));
        mvc.perform(register(body(plantRoomId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value(allOf(containsString("already registered"), not(containsString("Device_")))));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{\"identifier\":\"  \",\"model\":\"PT-100\",\"locationId\":\"%s\",\"metrics\":[\"POWER\"],"
                        + "\"reportingIntervalSeconds\":60}",
                "{\"identifier\":\"PUMP-01\",\"locationId\":\"%s\",\"metrics\":[\"POWER\"],"
                        + "\"reportingIntervalSeconds\":60}",
                "{\"identifier\":\"PUMP-01\",\"model\":\"PT-100\",\"metrics\":[\"POWER\"],"
                        + "\"reportingIntervalSeconds\":60}",
                "{\"identifier\":\"PUMP-01\",\"model\":\"PT-100\",\"locationId\":\"%s\",\"metrics\":[],"
                        + "\"reportingIntervalSeconds\":60}",
                "{\"identifier\":\"PUMP-01\",\"model\":\"PT-100\",\"locationId\":\"%s\",\"metrics\":[\"NOISE\"],"
                        + "\"reportingIntervalSeconds\":60}",
                "{\"identifier\":\"PUMP-01\",\"model\":\"PT-100\",\"locationId\":\"%s\",\"metrics\":[\"POWER\"]}",
                "{\"identifier\":\"PUMP-01\",\"model\":\"PT-100\",\"locationId\":\"%s\",\"metrics\":[\"POWER\"],"
                        + "\"reportingIntervalSeconds\":0}",
                "{\"identifier\":\"PUMP-01\",\"model\":\"PT-100\",\"locationId\":\"%s\",\"metrics\":[\"POWER\"],"
                        + "\"reportingIntervalSeconds\":86401}"
            })
    void rejectsMissingOrInvalidDetails(String template) throws Exception {
        mvc.perform(register(template.formatted(plantRoomId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsRegistrationOnADeactivatedAsset() throws Exception {
        when(assets.find(assetId, estateId, true)).thenReturn(Optional.of(asset(now)));
        mvc.perform(register(body(plantRoomId))).andExpect(status().isConflict());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void rejectsRegistrationInAnInactiveEstate() throws Exception {
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(now)));
        mvc.perform(register(body(plantRoomId))).andExpect(status().isConflict());
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void hidesOtherOwnersEstatesAndUnknownAssets() throws Exception {
        mvc.perform(as("other", get(base))).andExpect(status().isNotFound());
        mvc.perform(as("other", post(base))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(plantRoomId)))
                .andExpect(status().isNotFound());
        var unknownAsset = "/estates/" + estateId + "/assets/" + foreignId + "/devices";
        mvc.perform(as("owner", get(unknownAsset)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Asset not found."));
        verify(repository, never()).create(any(), any(), any());
    }

    @Test
    void listsTheAssetsDevicesWithUnits() throws Exception {
        when(repository.listForAsset(assetId)).thenReturn(List.of(device("PUMP-01", pipeRunId, "FLOW_RATE")));
        mvc.perform(as("owner", get(base)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].identifier").value("PUMP-01"))
                .andExpect(jsonPath("$[0].metrics[0].metric").value("FLOW_RATE"))
                .andExpect(jsonPath("$[0].metrics[0].unit").value("L/min"))
                .andExpect(jsonPath("$[0].lastSeenAt").value(nullValue()));
    }

    // --- Deactivation and replacement (ID-45) ---

    private final UUID replacementId = UUID.fromString("00000000-0000-0000-0000-0000000000d2");
    private final String one = base + "/" + deviceId;

    private DeviceRecord stored(UUID id, String identifier, OffsetDateTime deactivatedAt, UUID replaces) {
        return new DeviceRecord(
                id,
                estateId,
                assetId,
                plantRoomId,
                identifier,
                "PT-100",
                new String[] {"TEMPERATURE"},
                60,
                null,
                now,
                now,
                deactivatedAt == null ? "hash" : null,
                deactivatedAt == null ? now : null,
                deactivatedAt,
                replaces);
    }

    private MockHttpServletRequestBuilder deactivate(String identifier) {
        return as("owner", post(one + "/deactivate"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"identifier\":\"%s\"}".formatted(identifier));
    }

    private MockHttpServletRequestBuilder replace(String json) {
        return as("owner", post(one + "/replace"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json);
    }

    private static String replacementBody(UUID locationId) {
        return """
                {"identifier":"PUMP-02","model":"PT-200","locationId":"%s",\
                "metrics":["TEMPERATURE"],"reportingIntervalSeconds":60}""".formatted(locationId);
    }

    @Test
    void deactivatesADeviceAndRemovesItsKey() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", null, null)));
        when(repository.deactivate(deviceId)).thenReturn(stored(deviceId, "PUMP-01", now, null));
        mvc.perform(deactivate("PUMP-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(deviceId.toString()))
                .andExpect(jsonPath("$.deactivatedAt").value("2026-09-28T00:00:00Z"))
                .andExpect(jsonPath("$.credentialIssuedAt").value(nullValue()));
        verify(repository).deactivate(deviceId);
    }

    @Test
    void requiresTheExactIdentifierToDeactivate() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", null, null)));
        mvc.perform(deactivate("pump-01"))
                .andExpect(status().isBadRequest())
                .andExpect(
                        jsonPath("$.message").value("Enter the device's identifier exactly to confirm deactivation."));
        verify(repository, never()).deactivate(any());
    }

    @Test
    void repeatedDeactivationKeepsTheOriginalTime() throws Exception {
        var earlier = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", earlier, null)));
        mvc.perform(deactivate("PUMP-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedAt").value("2026-01-01T00:00:00Z"));
        verify(repository, never()).deactivate(any());
    }

    @Test
    void rejectsDeactivationOnARetiredAssetOrInAnInactiveEstate() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", null, null)));
        when(assets.find(assetId, estateId, true)).thenReturn(Optional.of(asset(now)));
        mvc.perform(deactivate("PUMP-01")).andExpect(status().isConflict());
        when(assets.find(assetId, estateId, true)).thenReturn(Optional.of(asset(null)));
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(now)));
        mvc.perform(deactivate("PUMP-01")).andExpect(status().isConflict());
        verify(repository, never()).deactivate(any());
    }

    @Test
    void hidesDevicesElsewhereAndEstatesTheCallerDoesNotOwn() throws Exception {
        mvc.perform(deactivate("PUMP-01"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Device not found."));
        mvc.perform(as("other", post(one + "/deactivate"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"PUMP-01\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(replace(replacementBody(plantRoomId))).andExpect(status().isNotFound());
        verify(repository, never()).deactivate(any());
    }

    @Test
    void replacesADeviceWithANewOneThatRecordsWhatItReplaced() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", null, null)));
        when(repository.createReplacing(eq(estateId), eq(assetId), any(), eq(deviceId)))
                .thenReturn(stored(replacementId, "PUMP-02", null, deviceId));
        mvc.perform(replace(replacementBody(pipeRunId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(replacementId.toString()))
                .andExpect(jsonPath("$.identifier").value("PUMP-02"))
                .andExpect(jsonPath("$.replacesDeviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$.deactivatedAt").value(nullValue()));
        verify(repository).deactivate(deviceId);
    }

    @Test
    void rejectsReplacingADeviceThatIsAlreadyDeactivated() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", now, null)));
        mvc.perform(replace(replacementBody(plantRoomId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value("This device is already deactivated. Register a new device on the asset instead."));
        verify(repository, never()).createReplacing(any(), any(), any(), any());
    }

    @Test
    void keepsTheOldDeviceActiveWhenTheReplacementCannotBeRegistered() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", null, null)));
        when(repository.identifierTaken("PUMP-02")).thenReturn(true);
        mvc.perform(replace(replacementBody(plantRoomId))).andExpect(status().isConflict());
        mvc.perform(replace(replacementBody(foreignId))).andExpect(status().isNotFound());
        mvc.perform(replace(replacementBody(closedRoomId))).andExpect(status().isConflict());
        mvc.perform(replace("{\"identifier\":\"\"}")).andExpect(status().isBadRequest());
        verify(repository, never()).deactivate(any());
        verify(repository, never()).createReplacing(any(), any(), any(), any());
    }

    @Test
    void refusesAKeyForADeactivatedDevice() throws Exception {
        when(repository.find(deviceId, assetId, estateId, true))
                .thenReturn(Optional.of(stored(deviceId, "PUMP-01", now, null)));
        mvc.perform(as("owner", post(one + "/credential")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This device is deactivated. It cannot be given a key."));
        verify(repository, never()).replaceCredential(any(), any(), any(), any());
    }

    @Test
    void listsDevicesWithTheirReplacementLinks() throws Exception {
        when(repository.listForAsset(assetId))
                .thenReturn(List.of(
                        stored(replacementId, "PUMP-02", null, deviceId), stored(deviceId, "PUMP-01", now, null)));
        mvc.perform(as("owner", get(base)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].replacesDeviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$[0].replacedByDeviceId").value(nullValue()))
                .andExpect(jsonPath("$[1].deactivatedAt").value("2026-09-28T00:00:00Z"))
                .andExpect(jsonPath("$[1].replacedByDeviceId").value(replacementId.toString()));
    }
}
