package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** Device reporting status (ID-44): GET /estates/{estateId}/devices and the asset's device list. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceStatusIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estateId, locationId, assetId;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
    }

    ResultActions estateDevices(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/devices").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions assetDevices(String user) throws Exception {
        return mvc.perform(
                get("/estates/" + estateId + "/assets/" + assetId + "/devices").with(jwt().jwt(j -> j.subject(user))));
    }

    UUID device() {
        return data.device(estateId, locationId, assetId, null);
    }

    void lastSeenMinutesAgo(UUID device, int minutes) {
        db.execute(
                "update \"Device\" set \"lastSeenAt\" = now() - make_interval(mins => ?) where id = ?",
                minutes,
                device);
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    @Test
    void listsEachDeviceWithItsAssetLocationLastSeenAndStatus() throws Exception {
        var device = device();
        lastSeenMinutesAgo(device, 1);
        estateDevices("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(device.toString()))
                .andExpect(jsonPath("$[0].identifier").value("DEV-" + device))
                .andExpect(jsonPath("$[0].model").value("PT-100"))
                .andExpect(jsonPath("$[0].assetId").value(assetId.toString()))
                .andExpect(jsonPath("$[0].assetReference").value("A-" + assetId))
                .andExpect(jsonPath("$[0].assetName").value("Water Pump"))
                .andExpect(jsonPath("$[0].assetRetired").value(false))
                .andExpect(jsonPath("$[0].locationId").value(locationId.toString()))
                .andExpect(jsonPath("$[0].lastSeenAt").isNotEmpty())
                .andExpect(jsonPath("$[0].status").value("ONLINE"));
    }

    @Test
    void aDeviceThatHasNeverReportedIsAwaitingItsFirstReading() throws Exception {
        device();
        estateDevices("owner")
                .andExpect(jsonPath("$[0].lastSeenAt").isEmpty())
                .andExpect(jsonPath("$[0].status").value("AWAITING_FIRST_READING"));
    }

    @Test
    void aDeviceSilentPastFiveMinutesAtAOneMinuteIntervalIsOffline() throws Exception {
        lastSeenMinutesAgo(device(), 6);
        estateDevices("owner").andExpect(jsonPath("$[0].status").value("OFFLINE"));
    }

    @Test
    void listsOfflineThenAwaitingThenOnlineWithTheLongestSilentFirst() throws Exception {
        var online1 = device();
        var offline20 = device();
        var awaiting = device();
        var online2 = device();
        var offline10 = device();
        lastSeenMinutesAgo(online1, 1);
        lastSeenMinutesAgo(online2, 2);
        lastSeenMinutesAgo(offline10, 10);
        lastSeenMinutesAgo(offline20, 20);
        estateDevices("owner")
                .andExpect(jsonPath("$[0].id").value(offline20.toString()))
                .andExpect(jsonPath("$[1].id").value(offline10.toString()))
                .andExpect(jsonPath("$[2].id").value(awaiting.toString()))
                .andExpect(jsonPath("$[3].id").value(online2.toString()))
                .andExpect(jsonPath("$[4].id").value(online1.toString()));
    }

    @Test
    void marksDevicesOnARetiredAssetWithoutDeactivatingThem() throws Exception {
        lastSeenMinutesAgo(device(), 1);
        db.execute(
                "update \"Asset\" set \"deactivatedAt\" = now(), \"retiredOn\" = current_date where id = ?", assetId);
        estateDevices("owner")
                .andExpect(jsonPath("$[0].assetRetired").value(true))
                .andExpect(jsonPath("$[0].status").value("ONLINE"));
    }

    @Test
    void listsDevicesAcrossTheEstatesAssetsButNotOtherEstates() throws Exception {
        var otherAsset = data.asset(estateId, locationId);
        var mine = data.device(estateId, locationId, otherAsset, null);
        var elsewhere = data.estateWithAsset("owner");
        data.device(elsewhere[0], elsewhere[1], elsewhere[2], null);
        estateDevices("owner")
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(mine.toString()));
    }

    @Test
    void anEstateWithNoDevicesReturnsAnEmptyList() throws Exception {
        estateDevices("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void anInactiveEstatesDevicesAreStillReadable() throws Exception {
        device();
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        estateDevices("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void aManagerWhoIsNotTheOwnerCanReadDeviceStatus() throws Exception {
        lastSeenMinutesAgo(device(), 1);
        membership("manager", "MANAGER");
        estateDevices("manager")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("ONLINE"));
        assetDevices("manager")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("ONLINE"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "MEMBER"})
    void otherEstateRolesCannotSeeDevices(String role) throws Exception {
        device();
        membership("staff", role);
        estateDevices("staff").andExpect(status().isNotFound());
        assetDevices("staff").andExpect(status().isNotFound());
    }

    @Test
    void strangersCannotSeeDevices() throws Exception {
        device();
        estateDevices("stranger").andExpect(status().isNotFound());
        assetDevices("stranger").andExpect(status().isNotFound());
    }

    @Test
    void residentsAreRefusedManagementAccess() throws Exception {
        device();
        membership("resident", "RESIDENT");
        estateDevices("resident").andExpect(status().isForbidden());
        assetDevices("resident").andExpect(status().isForbidden());
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/devices")).andExpect(status().isUnauthorized());
    }
}
