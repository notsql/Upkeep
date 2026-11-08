package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.event.AssetEventType;
import com.proj.server.risk.FailureRiskCalculator;
import com.proj.server.risk.RiskAsset;
import com.proj.server.risk.RiskEvent;
import com.proj.server.workos.WorkOSService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
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

/** The 12-month maintenance budget forecast (ID-33, spec estate-costs.md). */
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
class BudgetForecastIntegrationTests {
    static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Singapore"));

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @Autowired
    FailureRiskCalculator calculator;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, locationId;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        locationId = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                locationId,
                estateId);
    }

    // ---- helpers -----------------------------------------------------------------------------------------------

    UUID asset(String reference, String category, LocalDate installedOn) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, ?, ?, ?, ?, now())",
                id,
                estateId,
                locationId,
                reference,
                "Asset " + reference,
                category,
                installedOn);
        return id;
    }

    void categoryInterval(String category, int value, String unit) {
        db.execute(
                "insert into \"AssetCategoryIntervalChange\" (id, \"estateId\", category, \"intervalValue\", \"intervalUnit\", \"changedByUserId\") values (?, ?, ?, ?, ?, 'owner')",
                UUID.randomUUID(),
                estateId,
                category,
                value,
                unit);
    }

    /** A manual entry dated {@code daysAgo}; null costs are unknown. */
    void entry(UUID asset, String type, int daysAgo, String labour, String parts, String other) {
        db.execute(
                "insert into \"AssetEvent\" (id, \"estateId\", \"assetId\", type, \"occurredOn\", notes, \"recordedByUserId\", \"labourCost\", \"partsCost\", \"otherCost\") values (?, ?, ?, ?, ?, 'Work', 'owner', ?::numeric, ?::numeric, ?::numeric)",
                UUID.randomUUID(),
                estateId,
                asset,
                type,
                TODAY.minusDays(daysAgo),
                labour,
                parts,
                other);
    }

    void service(UUID asset, String cost) {
        entry(asset, "PREVENTIVE", 400, cost, "0", "0");
    }

    void completedWorkOrder(UUID asset, String labour, String parts) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"WorkOrder\" (id, \"estateId\", reference, description, \"locationId\", \"assetId\", category, priority, source, status, \"createdByUserId\", \"updatedAt\") values (?, ?, ?, 'Fix it', ?, ?, 'EQUIPMENT_FAULT', 'MEDIUM', 'MANUAL', 'CLOSED', 'owner', now())",
                id,
                estateId,
                "W-" + id,
                locationId,
                asset);
        db.execute(
                "insert into \"WorkOrderCompletion\" (id, \"estateId\", \"workOrderId\", findings, \"workPerformed\", \"labourCost\", \"partsCost\", \"completedByUserId\") values (?, ?, ?, 'Found', 'Fixed', ?::numeric, ?::numeric, 'owner')",
                UUID.randomUUID(),
                estateId,
                id,
                labour,
                parts);
    }

    /** A lamp whose 6-month interval, counted from installation, next comes due on {@code dueOn}. */
    UUID lampDueOn(String reference, LocalDate dueOn) {
        return asset(reference, "LIGHTING", dueOn.minusMonths(6));
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions forecast(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/costs/forecast").with(jwt().jwt(j -> j.subject(user))));
    }

    static String money(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    // ---- the window and totals ---------------------------------------------------------------------------------

    @Test
    void anEmptyEstateProjectsNothingOverTheNext12Months() throws Exception {
        forecast("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value(TODAY.toString()))
                .andExpect(jsonPath("$.to").value(TODAY.plusMonths(12).toString()))
                .andExpect(jsonPath("$.total").value("0.00"))
                .andExpect(jsonPath("$.scheduledServices.total").value("0.00"))
                .andExpect(jsonPath("$.scheduledServices.services").value(0))
                .andExpect(jsonPath("$.predictedRepairs.total").value("0.00"))
                .andExpect(jsonPath("$.predictedRepairs.expectedRepairs").value(0.0))
                .andExpect(jsonPath("$.assetsWithoutCostBasis").value(0));
    }

    // ---- scheduled services ------------------------------------------------------------------------------------

    @Test
    void countsEachServiceInTheWindowAtTheAssetsAverageServiceCost() throws Exception {
        categoryInterval("LIGHTING", 6, "MONTH");
        var lamp = lampDueOn("L-1", TODAY.plusDays(7));
        service(lamp, "100.00");
        service(lamp, "200.00");
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.services").value(2))
                .andExpect(jsonPath("$.scheduledServices.total").value("300.00"))
                .andExpect(jsonPath("$.total").value("300.00"));
    }

    @Test
    void anOverdueServiceCountsFromToday() throws Exception {
        categoryInterval("LIGHTING", 6, "MONTH");
        service(lampDueOn("L-1", TODAY.minusDays(30)), "50.00");
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.services").value(2))
                .andExpect(jsonPath("$.scheduledServices.total").value("100.00"));
    }

    @Test
    void theClockCountsFromTheLastInspection() throws Exception {
        categoryInterval("LIGHTING", 12, "MONTH");
        var lamp = lampDueOn("L-1", TODAY.minusDays(30));
        db.execute(
                "insert into \"AssetInspectionResult\" (id, \"estateId\", \"assetId\", \"locationId\", \"locationPath\", outcome, \"inspectedOn\", \"recordedByUserId\") values (?, ?, ?, ?, 'Block A', 'PASS', ?, 'owner')",
                UUID.randomUUID(),
                estateId,
                lamp,
                locationId,
                TODAY);
        service(lamp, "80.00");
        forecast("owner").andExpect(jsonPath("$.scheduledServices.services").value(0));
    }

    @Test
    void aShortIntervalCountsEveryDateInTheWindow() throws Exception {
        categoryInterval("LIGHTING", 30, "DAY");
        var lamp = asset("L-1", "LIGHTING", TODAY.minusDays(25));
        service(lamp, "10.00");
        int expected = 0;
        for (var date = TODAY.plusDays(5); date.isBefore(TODAY.plusMonths(12)); date = date.plusDays(30)) {
            expected++;
        }
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.services").value(expected))
                .andExpect(jsonPath("$.scheduledServices.total").value(money(expected * 10.0)));
    }

    @Test
    void withoutItsOwnHistoryAnAssetUsesItsCategorysAverage() throws Exception {
        categoryInterval("LIGHTING", 12, "MONTH");
        var lamp = lampDueOn("L-1", TODAY.plusMonths(13));
        service(lamp, "100.00");
        service(lamp, "300.00");
        lampDueOn("L-2", TODAY.plusDays(10));
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.services").value(1))
                .andExpect(jsonPath("$.scheduledServices.total").value("200.00"))
                .andExpect(jsonPath("$.assetsWithoutCostBasis").value(0));
    }

    @Test
    void entriesWithNoKnownCostDoNotCountTowardsAverages() throws Exception {
        categoryInterval("LIGHTING", 12, "MONTH");
        var lamp = lampDueOn("L-1", TODAY.plusDays(10));
        service(lamp, "90.00");
        entry(lamp, "PREVENTIVE", 200, null, null, null);
        entry(lamp, "PREVENTIVE", 100, "10.00", null, "0");
        forecast("owner").andExpect(jsonPath("$.scheduledServices.total").value("50.00"));
    }

    @Test
    void assetsWithNoCostHistoryAreLeftOutAndCounted() throws Exception {
        categoryInterval("LIGHTING", 6, "MONTH");
        lampDueOn("L-1", TODAY.plusDays(10));
        lampDueOn("L-2", TODAY.plusDays(20));
        asset("P-1", "PUMP", null);
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.services").value(0))
                .andExpect(jsonPath("$.total").value("0.00"))
                .andExpect(jsonPath("$.assetsWithoutCostBasis").value(2));
    }

    @Test
    void retiredAssetsAreNotProjectedButTheirHistoryCounts() throws Exception {
        categoryInterval("LIGHTING", 12, "MONTH");
        var retired = lampDueOn("L-1", TODAY.plusDays(10));
        service(retired, "120.00");
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", retired);
        lampDueOn("L-2", TODAY.plusDays(10));
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.services").value(1))
                .andExpect(jsonPath("$.scheduledServices.total").value("120.00"));
    }

    // ---- predicted repairs -------------------------------------------------------------------------------------

    double yearProbability(LocalDate installedOn, int... breakdownDaysAgo) {
        var events = java.util.Arrays.stream(breakdownDaysAgo)
                .mapToObj(days -> new RiskEvent(AssetEventType.BREAKDOWN_REPAIR, TODAY.minusDays(days), null, null))
                .toList();
        return calculator.probabilityWithin(new RiskAsset("PUMP", installedOn, null, null), events, TODAY, 365);
    }

    @Test
    void aPumpsYearlyBreakdownChanceTimesItsAverageRepairCost() throws Exception {
        var pump = asset("P-1", "PUMP", TODAY.minusDays(400));
        entry(pump, "BREAKDOWN_REPAIR", 270, "300.00", "100.00", "0");
        entry(pump, "BREAKDOWN_REPAIR", 90, "500.00", "100.00", null);
        var probability = yearProbability(TODAY.minusDays(400), 270, 90);
        forecast("owner")
                .andExpect(jsonPath("$.predictedRepairs.expectedRepairs")
                        .value(BigDecimal.valueOf(probability)
                                .setScale(2, RoundingMode.HALF_UP)
                                .doubleValue()))
                .andExpect(jsonPath("$.predictedRepairs.total").value(money(probability * 500)))
                .andExpect(jsonPath("$.total").value(money(probability * 500)));
    }

    @Test
    void completedWorkOrdersAreRepairCostHistoryToo() throws Exception {
        var pump = asset("P-1", "PUMP", TODAY.minusDays(400));
        completedWorkOrder(pump, "700.00", "100.00");
        var probability = yearProbability(TODAY.minusDays(400));
        forecast("owner").andExpect(jsonPath("$.predictedRepairs.total").value(money(probability * 800)));
    }

    @Test
    void aPumpWithoutRepairCostsUsesOtherPumpsOrIsLeftOut() throws Exception {
        var costed = asset("P-1", "PUMP", TODAY.minusDays(400));
        completedWorkOrder(costed, "1000.00", "0");
        asset("P-2", "PUMP", TODAY.minusDays(400));
        var each = yearProbability(TODAY.minusDays(400));
        forecast("owner")
                .andExpect(jsonPath("$.predictedRepairs.total").value(money(2 * each * 1000)))
                .andExpect(jsonPath("$.assetsWithoutCostBasis").value(0));
    }

    @Test
    void pumpsWithAForecastButNoRepairCostsAnywhereAreLeftOut() throws Exception {
        asset("P-1", "PUMP", TODAY.minusDays(400));
        asset("P-2", "PUMP", null);
        forecast("owner")
                .andExpect(jsonPath("$.predictedRepairs.total").value("0.00"))
                .andExpect(jsonPath("$.assetsWithoutCostBasis").value(1));
    }

    @Test
    void aPumpWithAnIntervalContributesBothServicesAndRepairs() throws Exception {
        categoryInterval("PUMP", 12, "MONTH");
        var pump = asset("P-1", "PUMP", TODAY.minusMonths(12).plusDays(10));
        var retired = asset("P-0", "PUMP", null);
        service(retired, "60.00");
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", retired);
        completedWorkOrder(pump, "500.00", "0");
        var probability = yearProbability(TODAY.minusMonths(12).plusDays(10));
        var repairs = BigDecimal.valueOf(probability * 500).setScale(2, RoundingMode.HALF_UP);
        forecast("owner")
                .andExpect(jsonPath("$.scheduledServices.total").value("60.00"))
                .andExpect(jsonPath("$.predictedRepairs.total").value(repairs.toPlainString()))
                .andExpect(jsonPath("$.total")
                        .value(repairs.add(new BigDecimal("60.00")).toPlainString()));
    }

    // ---- access ------------------------------------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "MEMBER", "CREW"})
    void onlyTheOwnerCanSeeIt(String role) throws Exception {
        membership("someone", role);
        forecast("someone").andExpect(status().isNotFound());
    }

    @Test
    void aResidentIsRefused() throws Exception {
        membership("resident", "RESIDENT");
        forecast("resident").andExpect(status().isForbidden());
    }

    @Test
    void anInactiveEstateStillAnswers() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        forecast("owner").andExpect(status().isOk());
    }
}
