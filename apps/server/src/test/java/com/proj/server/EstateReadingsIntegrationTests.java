package com.proj.server;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateroledefinition.ESTATEROLEDEFINITION;
import static com.proj.server.db.tables.Estaterolepermission.ESTATEROLEPERMISSION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
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

/** ID-60: the estate browser is read-only and independent of asset-register authority. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EstateReadingsIntegrationTests {
    static final OffsetDateTime T0 = OffsetDateTime.parse("2026-10-01T00:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estate, location, asset, device, secondAsset, secondDevice;
    String path;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        device = data.device(estate, location, asset, null);
        secondAsset = data.asset(estate, location);
        secondDevice = data.device(estate, location, secondAsset, null);
        db.update(ASSET)
                .set(ASSET.NAME, "Booster pump")
                .set(ASSET.REFERENCE, "PUMP-002")
                .where(ASSET.ID.eq(secondAsset))
                .execute();
        path = "/estates/" + estate + "/readings";
    }

    void member(String user, String role) {
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, user)
                .set(ESTATEUSER.ROLE, role)
                .execute();
    }

    UUID reading(UUID onAsset, UUID onDevice, String metric, String value, OffsetDateTime at) {
        var id = UUID.randomUUID();
        db.insertInto(DEVICEREADING)
                .set(DEVICEREADING.ID, id)
                .set(DEVICEREADING.ESTATEID, estate)
                .set(DEVICEREADING.ASSETID, onAsset)
                .set(DEVICEREADING.DEVICEID, onDevice)
                .set(DEVICEREADING.METRIC, metric)
                .set(DEVICEREADING.VALUE, new BigDecimal(value))
                .set(DEVICEREADING.MEASUREDAT, at)
                .set(DEVICEREADING.RECEIVEDAT, currentOffsetDateTime())
                .execute();
        return id;
    }

    ResultActions list(String query) throws Exception {
        return mvc.perform(get(path + query).with(jwt().jwt(j -> j.subject("owner"))));
    }

    @Test
    void listsMultipleAssetsWithLabelsAndDeterministicTimestampOrdering() throws Exception {
        reading(asset, device, "TEMPERATURE", "21", T0);
        var a = reading(secondAsset, secondDevice, "PRESSURE", "2", T0.plusMinutes(1));
        var b = reading(asset, device, "TEMPERATURE", "22", T0.plusMinutes(1));
        var newest = a.toString().compareTo(b.toString()) > 0 ? a : b;
        var foreign = data.estateWithAsset("owner");
        var foreignDevice = data.device(foreign[0], foreign[1], foreign[2], null);
        db.insertInto(DEVICEREADING)
                .set(DEVICEREADING.ID, UUID.randomUUID())
                .set(DEVICEREADING.ESTATEID, foreign[0])
                .set(DEVICEREADING.ASSETID, foreign[2])
                .set(DEVICEREADING.DEVICEID, foreignDevice)
                .set(DEVICEREADING.METRIC, "TEMPERATURE")
                .set(DEVICEREADING.VALUE, BigDecimal.valueOf(99))
                .set(DEVICEREADING.MEASUREDAT, T0.plusDays(1))
                .set(DEVICEREADING.RECEIVEDAT, currentOffsetDateTime())
                .execute();
        list("?size=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[0].id").value(newest.toString()))
                .andExpect(jsonPath("$.items[0].assetId").isString())
                .andExpect(jsonPath("$.items[0].assetName").isString())
                .andExpect(jsonPath("$.items[0].assetReference").isString())
                .andExpect(jsonPath("$.items[0].deviceIdentifier").isString());
        list("?size=1&page=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].measuredAt").value("2026-10-01T00:00:00Z"));
    }

    @Test
    void combinesAssetMetricAndHalfOpenTimeFiltersBeforeCountingAndPaging() throws Exception {
        reading(asset, device, "PRESSURE", "1", T0.minusMinutes(1));
        var match = reading(asset, device, "PRESSURE", "2", T0);
        reading(asset, device, "PRESSURE", "3", T0.plusMinutes(10));
        reading(asset, device, "TEMPERATURE", "24", T0.plusMinutes(1));
        reading(secondAsset, secondDevice, "PRESSURE", "4", T0.plusMinutes(2));
        list("?assetId=" + asset + "&metric=PRESSURE&from=2026-10-01T00:00:00Z&to=2026-10-01T00:10:00Z")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(match.toString()))
                .andExpect(jsonPath("$.items[0].unit").value("bar"));
    }

    @Test
    void computesFlagsPerAssetAndKeepsPredecessorsOutsideTheTimeFilter() throws Exception {
        reading(asset, device, "TEMPERATURE", "21", T0.minusMinutes(5));
        reading(asset, device, "TEMPERATURE", "22", T0);
        reading(secondAsset, secondDevice, "TEMPERATURE", "23", T0);
        list("?from=2026-10-01T00:00:00Z&flag=GAP&flag=DUPLICATE_TIMESTAMP")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].assetId").value(asset.toString()))
                .andExpect(jsonPath("$.items[0].flags.length()").value(1))
                .andExpect(jsonPath("$.items[0].flags[0].type").value("GAP"))
                .andExpect(jsonPath("$.items[0].flags[0].gapSeconds").value(300));
    }

    @Test
    void preservesDuplicateAndOutOfRangeFlagsOnTheSameAsset() throws Exception {
        var anotherDevice = data.device(estate, location, asset, null);
        reading(asset, device, "TEMPERATURE", "151", T0);
        reading(asset, anotherDevice, "TEMPERATURE", "20", T0);
        list("?flag=OUT_OF_RANGE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].flags[0].type").value("DUPLICATE_TIMESTAMP"))
                .andExpect(jsonPath("$.items[0].flags[1].type").value("OUT_OF_RANGE"));
    }

    @Test
    void historicalReadingsStayWithTheirOriginalAssetWhenADeviceMoves() throws Exception {
        reading(asset, device, "TEMPERATURE", "21", T0);
        db.update(DEVICE)
                .set(DEVICE.ASSETID, secondAsset)
                .where(DEVICE.ID.eq(device))
                .execute();
        list("?assetId=" + asset)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].assetId").value(asset.toString()));
        list("?assetId=" + secondAsset)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void managersAndCrewCanReadWithoutGainingAssetRegisterAccess(String role) throws Exception {
        member("reader", role);
        reading(asset, device, "TEMPERATURE", "21", T0);
        mvc.perform(get(path).with(jwt().jwt(j -> j.subject("reader"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get(path + "/assets").with(jwt().jwt(j -> j.subject("reader"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(get("/estates/" + estate + "/assets").with(jwt().jwt(j -> j.subject("reader"))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/access/context").with(jwt().jwt(j -> j.subject("reader"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewReadings").value(true))
                .andExpect(jsonPath("$.estates[0].canViewAssets").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"RESIDENT", "COUNCIL", "MEMBER"})
    void otherMembershipsCannotReadOrDiscoverReadingAssetOptions(String role) throws Exception {
        member("reader", role);
        for (String suffix : new String[] {"", "/assets"}) {
            mvc.perform(get(path + suffix).with(jwt().jwt(j -> j.subject("reader"))))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get("/access/context").with(jwt().jwt(j -> j.subject("reader"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewReadings").value(false));
    }

    @Test
    void customDocumentAndEstatePermissionsDoNotGrantReadingsAccess() throws Exception {
        var role = UUID.randomUUID();
        db.insertInto(ESTATEROLEDEFINITION)
                .set(ESTATEROLEDEFINITION.ID, role)
                .set(ESTATEROLEDEFINITION.ESTATEID, estate)
                .set(ESTATEROLEDEFINITION.NAME, "Viewer")
                .set(ESTATEROLEDEFINITION.NORMALIZEDNAME, "viewer")
                .set(ESTATEROLEDEFINITION.CREATEDBYUSERID, "owner")
                .set(ESTATEROLEDEFINITION.UPDATEDAT, currentOffsetDateTime())
                .execute();
        db.insertInto(ESTATEROLEPERMISSION)
                .columns(ESTATEROLEPERMISSION.ROLEID, ESTATEROLEPERMISSION.PERMISSION)
                .values(role, "VIEW_ESTATE")
                .values(role, "VIEW_DOCUMENTS")
                .execute();
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, "custom")
                .set(ESTATEUSER.ROLE, "CUSTOM")
                .set(ESTATEUSER.CUSTOMROLEID, role)
                .execute();
        mvc.perform(get(path).with(jwt().jwt(j -> j.subject("custom")))).andExpect(status().isForbidden());
        mvc.perform(get(path + "/assets").with(jwt().jwt(j -> j.subject("custom"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownerHasCapabilityEvenOnAnInactiveEstateAndCanReadRetiredAssets() throws Exception {
        reading(asset, device, "TEMPERATURE", "21", T0);
        db.update(ESTATE)
                .set(ESTATE.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ESTATE.ID.eq(estate))
                .execute();
        db.update(ASSET)
                .set(ASSET.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ASSET.ID.eq(asset))
                .execute();
        list("?assetId=" + asset)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/access/context").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(jsonPath("$.estates[0].canViewReadings").value(true));
    }

    @Test
    void revokingCrewMembershipImmediatelyRemovesReadAccess() throws Exception {
        member("crew", "CREW");
        mvc.perform(get(path).with(jwt().jwt(j -> j.subject("crew")))).andExpect(status().isOk());
        db.deleteFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estate), ESTATEUSER.USERID.eq("crew"))
                .execute();
        mvc.perform(get(path).with(jwt().jwt(j -> j.subject("crew")))).andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedForeignAndMissingResourcesAreDenied() throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path + "/assets")).andExpect(status().isUnauthorized());
        mvc.perform(get(path).with(jwt().jwt(j -> j.subject("stranger")))).andExpect(status().isNotFound());
        mvc.perform(get("/estates/" + UUID.randomUUID() + "/readings").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        var foreign = data.estateWithAsset("owner");
        list("?assetId=" + foreign[2]).andExpect(status().isNotFound());
        list("?assetId=" + UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void readingEndpointsDoNotAcceptWrites() throws Exception {
        member("crew", "CREW");
        mvc.perform(post(path).with(jwt().jwt(j -> j.subject("crew")))).andExpect(status().isForbidden());
    }

    @Test
    void searchesAndPaginatesMinimalSameEstateAssetOptionsIncludingRetiredAssets() throws Exception {
        db.update(ASSET)
                .set(ASSET.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ASSET.ID.eq(secondAsset))
                .execute();
        data.estateWithAsset("owner");
        list("/assets?search=booster&size=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(secondAsset.toString()))
                .andExpect(jsonPath("$.items[0].reference").value("PUMP-002"))
                .andExpect(jsonPath("$.items[0].retired").value(true))
                .andExpect(jsonPath("$.items[0].cost").doesNotExist())
                .andExpect(jsonPath("$.items[0].credentialHash").doesNotExist());
        list("/assets?search=pump-002").andExpect(jsonPath("$.totalItems").value(1));
        list("/assets?size=1&page=1")
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items.length()").value(1));
        list("/assets?search=not-found").andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    void emptyListsAndOutOfBoundsPagesKeepTheirMatchingTotal() throws Exception {
        list("").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        reading(asset, device, "TEMPERATURE", "21", T0);
        list("?metric=PRESSURE").andExpect(jsonPath("$.totalItems").value(0));
        list("?page=9")
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "?page=-1",
                "?size=0",
                "?size=201",
                "?page=abc",
                "?assetId=bad",
                "?metric=BAD",
                "?flag=BAD",
                "?from=bad",
                "?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z",
                "?from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00Z",
                "/assets?page=-1",
                "/assets?size=201"
            })
    void invalidQueriesHaveReadableBadRequestResponses(String query) throws Exception {
        list(query)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isString());
    }
}
