package com.proj.server;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
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

/** The estate's five costliest assets (ID-34, spec estate-costs.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "app.r2.endpoint=",
            "app.r2.access-id=",
            "app.r2.secret-access-key=",
            "app.r2.bucket-name="
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CostliestAssetsIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, locationId;

    @BeforeEach
    void setup() {
        estateId = estate("owner");
        locationId = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                locationId,
                estateId);
    }

    UUID estate(String owner) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, ?, 'Estate', ?, 'Road', '123456', now())",
                id,
                owner,
                id.toString());
        return id;
    }

    UUID asset(String reference, String category) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, ?, ?, ?, now())",
                id,
                estateId,
                locationId,
                reference,
                "Asset " + reference,
                category);
        return id;
    }

    /** A manual maintenance entry; null costs are unknown. */
    void entry(UUID asset, String type, String labour, String parts, String other) {
        db.execute(
                "insert into \"AssetEvent\" (id, \"estateId\", \"assetId\", type, \"occurredOn\", notes, \"recordedByUserId\", \"labourCost\", \"partsCost\", \"otherCost\") values (?, ?, ?, ?, ?, 'Work', 'owner', ?::numeric, ?::numeric, ?::numeric)",
                UUID.randomUUID(),
                estateId,
                asset,
                type,
                LocalDate.now().minusDays(10),
                labour,
                parts,
                other);
    }

    void entry(UUID asset, String labour, String parts, String other) {
        entry(asset, "PREVENTIVE", labour, parts, other);
    }

    /** A work order with the given status; a CLOSED one gets a completion with these costs. */
    void workOrder(UUID asset, String status, String labour, String parts) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"WorkOrder\" (id, \"estateId\", reference, description, \"locationId\", \"assetId\", category, priority, source, status, \"createdByUserId\", \"updatedAt\") values (?, ?, ?, 'Fix it', ?, ?, 'EQUIPMENT_FAULT', 'MEDIUM', 'MANUAL', ?, 'owner', now())",
                id,
                estateId,
                "W-" + id,
                locationId,
                asset,
                status);
        if ("CLOSED".equals(status)) {
            db.execute(
                    "insert into \"WorkOrderCompletion\" (id, \"estateId\", \"workOrderId\", findings, \"workPerformed\", \"labourCost\", \"partsCost\", \"completedByUserId\") values (?, ?, ?, 'Found', 'Fixed', ?::numeric, ?::numeric, 'owner')",
                    UUID.randomUUID(),
                    estateId,
                    id,
                    labour,
                    parts);
        }
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions top(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/costs/top-assets").with(jwt().jwt(j -> j.subject(user))));
    }

    @Test
    void anEstateWithNoCostsListsNothing() throws Exception {
        asset("P-1", "PUMP");
        top("owner").andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void sumsManualEntriesAndCompletedWorkOrders() throws Exception {
        var pump = asset("P-1", "PUMP");
        entry(pump, "100.00", "50.25", "10.00");
        workOrder(pump, "CLOSED", "200.00", "39.75");
        top("owner")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].assetId").value(pump.toString()))
                .andExpect(jsonPath("$[0].assetReference").value("P-1"))
                .andExpect(jsonPath("$[0].assetName").value("Asset P-1"))
                .andExpect(jsonPath("$[0].category").value("PUMP"))
                .andExpect(jsonPath("$[0].categoryLabel").value("Pump"))
                .andExpect(jsonPath("$[0].totalSpend").value("400.00"))
                .andExpect(jsonPath("$[0].entriesWithUnknownCosts").value(0));
    }

    @Test
    void ranksTheFiveCostliestHighestFirstWithTiesByReference() throws Exception {
        entry(asset("A-1", "PUMP"), "10.00", "0", "0");
        entry(asset("A-2", "PUMP"), "70.00", "0", "0");
        entry(asset("A-3", "LIFT"), "50.00", "0", "0");
        entry(asset("A-5", "LIFT"), "50.00", "0", "0");
        entry(asset("A-4", "LIGHTING"), "50.00", "0", "0");
        entry(asset("A-6", "PUMP"), "90.00", "0", "0");
        top("owner")
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].assetReference").value("A-6"))
                .andExpect(jsonPath("$[1].assetReference").value("A-2"))
                .andExpect(jsonPath("$[2].assetReference").value("A-3"))
                .andExpect(jsonPath("$[3].assetReference").value("A-4"))
                .andExpect(jsonPath("$[4].assetReference").value("A-5"));
    }

    @Test
    void unknownPartsCountAsNothingAndAreNoted() throws Exception {
        var pump = asset("P-1", "PUMP");
        entry(pump, "100.00", null, "5.00");
        entry(pump, null, null, null);
        workOrder(pump, "CLOSED", null, "20.00");
        workOrder(pump, "CLOSED", "30.00", "0.00");
        top("owner")
                .andExpect(jsonPath("$[0].totalSpend").value("155.00"))
                .andExpect(jsonPath("$[0].entriesWithUnknownCosts").value(3));
    }

    @Test
    void assetsWithNoKnownCostOrOnlyZeroAreLeftOut() throws Exception {
        entry(asset("P-1", "PUMP"), null, null, null);
        entry(asset("P-2", "PUMP"), "0", "0.00", "0");
        top("owner").andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void openWorkOrdersAndOtherAssetsCostsDoNotCount() throws Exception {
        var pump = asset("P-1", "PUMP");
        entry(pump, "10.00", "0", "0");
        workOrder(pump, "IN_PROGRESS", null, null);
        workOrder(null, "CLOSED", "999.00", "0");
        var other = estateId;
        estateId = estate("stranger");
        var location = locationId;
        locationId = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block B', now())",
                locationId,
                estateId);
        entry(asset("X-1", "PUMP"), "5000.00", "0", "0");
        estateId = other;
        locationId = location;
        top("owner")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].totalSpend").value("10.00"));
    }

    @Test
    void retiredAssetsAreLeftOut() throws Exception {
        var retired = asset("P-1", "PUMP");
        entry(retired, "500.00", "0", "0");
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", retired);
        entry(asset("P-2", "PUMP"), "5.00", "0", "0");
        top("owner")
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].assetReference").value("P-2"));
    }

    @Test
    void largeSumsStayExact() throws Exception {
        var pump = asset("P-1", "PUMP");
        entry(pump, "999999999999.99", "0.01", "0");
        entry(pump, "0.10", "0.20", "0");
        top("owner").andExpect(jsonPath("$[0].totalSpend").value("1000000000000.30"));
    }

    @Test
    void anInactiveEstateStillAnswers() throws Exception {
        entry(asset("P-1", "PUMP"), "10.00", "0", "0");
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        top("owner").andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "MEMBER", "CREW"})
    void onlyTheOwnerCanSeeIt(String role) throws Exception {
        membership("someone", role);
        top("someone").andExpect(status().isNotFound());
    }

    @Test
    void aResidentIsRefused() throws Exception {
        membership("resident", "RESIDENT");
        top("resident").andExpect(status().isForbidden());
    }

    @Test
    void signInIsRequired() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/costs/top-assets")).andExpect(status().isUnauthorized());
    }
}
