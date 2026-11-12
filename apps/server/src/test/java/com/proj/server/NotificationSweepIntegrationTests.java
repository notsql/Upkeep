package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.category.ServiceIntervalService;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** The daily sweep and milestone reminders (ID-103, ID-101, spec notification-switches-and-milestone-reminders.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class NotificationSweepIntegrationTests {
    static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Singapore"));

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    @MockitoSpyBean
    ServiceIntervalService intervals;

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
        categoryInterval("LIGHTING", 6, "MONTH");
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

    /** A lamp whose 6-month interval, counted from installation, comes due on {@code dueOn}. */
    UUID lampDueOn(String reference, LocalDate dueOn) {
        return asset(reference, "LIGHTING", dueOn.minusMonths(6));
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

    void assetInterval(UUID asset, int value, String unit) {
        db.execute(
                "insert into \"AssetIntervalChange\" (id, \"assetId\", \"intervalValue\", \"intervalUnit\", \"changedByUserId\") values (?, ?, ?, ?, 'owner')",
                UUID.randomUUID(),
                asset,
                value,
                unit);
    }

    void inspected(UUID asset, LocalDate on) {
        db.execute(
                "insert into \"AssetInspectionResult\" (id, \"estateId\", \"assetId\", \"locationId\", \"locationPath\", outcome, \"inspectedOn\", \"recordedByUserId\") values (?, ?, ?, ?, 'Block A', 'PASS', ?, 'owner')",
                UUID.randomUUID(),
                estateId,
                asset,
                locationId,
                on);
    }

    void workOrder(UUID asset, String status) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"WorkOrder\" (id, \"estateId\", reference, description, \"locationId\", \"assetId\", category, priority, source, status, \"createdByUserId\", \"updatedAt\") values (?, ?, ?, 'Fix it', ?, ?, 'EQUIPMENT_FAULT', 'MEDIUM', 'MANUAL', ?, 'owner', now())",
                id,
                estateId,
                "W-" + id,
                locationId,
                asset,
                status);
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions count(String user) throws Exception {
        return mvc.perform(get("/notifications/unread-count").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions list(String user) throws Exception {
        return mvc.perform(get("/notifications").with(jwt().jwt(j -> j.subject(user))));
    }

    /** Pretends the next read is on a later day: today's sweep record goes. */
    void nextDay() {
        db.execute("delete from \"NotificationSweep\" where \"estateId\" = ?", estateId);
    }

    List<Record> due() {
        return db.fetch(
                "select * from \"Notification\" where \"estateId\" = ? and type = 'SERVICE_DUE' order by \"resolvedAt\" nulls last, id",
                estateId);
    }

    List<Record> open() {
        return due().stream().filter(row -> row.get("resolvedAt") == null).toList();
    }

    int sweeps() {
        return ((Number) db.fetchValue(
                        "select count(*) from \"NotificationSweep\" where \"estateId\" = ? and day = ?",
                        estateId,
                        TODAY))
                .intValue();
    }

    // ---- the sweep ---------------------------------------------------------------------------------------------

    @Test
    void readingTheCountSweepsTheEstateOncePerDay() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(10));
        count("owner").andExpect(status().isOk()).andExpect(jsonPath("$.unread").value(1));
        assertEquals(1, sweeps());
        assertEquals(1, due().size());
    }

    @Test
    void readingTheListSweepsToo() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(10));
        list("owner")
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].type").value("SERVICE_DUE"));
    }

    @Test
    void aSweptEstateIsNotSweptAgainTheSameDay() throws Exception {
        count("owner");
        lampDueOn("L-1", TODAY.plusDays(10));
        count("owner").andExpect(jsonPath("$.unread").value(0));
        nextDay();
        count("owner").andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void managersTriggerTheSweepButOtherRolesDoNot() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(10));
        membership("council", "COUNCIL");
        count("council").andExpect(jsonPath("$.unread").value(0));
        assertEquals(0, sweeps());
        membership("manager", "MANAGER");
        count("manager").andExpect(jsonPath("$.unread").value(1));
        assertEquals(1, sweeps());
    }

    @Test
    void anInactiveEstateIsNotSwept() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(10));
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        count("owner").andExpect(jsonPath("$.unread").value(0));
        assertEquals(0, sweeps());
    }

    @Test
    void aFailedSweepNeverFailsTheReadAndIsRetried() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(5));
        doThrow(new IllegalStateException("boom")).when(intervals).effectiveForEstate(any(), any());
        count("owner").andExpect(status().isOk()).andExpect(jsonPath("$.unread").value(0));
        list("owner").andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        assertEquals(0, sweeps());

        doCallRealMethod().when(intervals).effectiveForEstate(any(), any());
        count("owner").andExpect(jsonPath("$.unread").value(1));
        assertEquals(1, sweeps());
    }

    void switches(boolean serviceDue, boolean repairPredicted) throws Exception {
        mvc.perform(put("/estates/" + estateId + "/notification-settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"anomalyEnabled\":true,\"serviceDueEnabled\":" + serviceDue
                                        + ",\"repairPredictedEnabled\":" + repairPredicted
                                        + ",\"checkRequestedEnabled\":true,\"checkFailedEnabled\":true,\"workOrderAssignedEnabled\":true}")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk());
    }

    @Test
    void savingSettingsSweepsAgainOnTheNextRead() throws Exception {
        switches(false, true);
        lampDueOn("L-1", TODAY.plusDays(20));
        count("owner").andExpect(jsonPath("$.unread").value(0));
        switches(true, true);
        count("owner").andExpect(jsonPath("$.unread").value(1));
    }

    // ---- SERVICE_DUE (ID-103) ----------------------------------------------------------------------------------

    @Test
    void anAssetAtTheFourteenDayMilestoneIsNotified() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(14));
        count("owner");
        var notification = open().getFirst();
        assertEquals(lamp, notification.get("assetId"));
        assertEquals(TODAY.plusDays(14), notification.get("dueOn", LocalDate.class));
        assertEquals(6, notification.get("intervalValue", Integer.class));
        assertEquals("MONTH", notification.get("intervalUnit"));
        assertEquals("CATEGORY", notification.get("intervalSource"));
        assertEquals("Service due on " + DATE.format(TODAY.plusDays(14)), notification.get("summary"));
        assertEquals(14, notification.get("milestoneDays", Integer.class));
    }

    static final java.time.format.DateTimeFormatter DATE =
            java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.ENGLISH);

    @Test
    void nothingIsRaisedMoreThan90DaysAhead() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(91));
        count("owner").andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void theNinetyDayReminderSaysSo() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(90));
        count("owner").andExpect(jsonPath("$.unread").value(1));
        var notification = open().getFirst();
        assertEquals(90, notification.get("milestoneDays", Integer.class));
        assertEquals(
                "Service due in 90 days (on " + DATE.format(TODAY.plusDays(90)) + ")", notification.get("summary"));
        list("owner").andExpect(jsonPath("$.items[0].milestoneDays").value(90));
    }

    /** A service reminder raised before today, as an earlier sweep would have. */
    UUID earlierReminder(UUID asset, LocalDate dueOn, Integer milestone, boolean resolved) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"dueOn\", \"intervalValue\", \"intervalUnit\", \"intervalSource\", \"milestoneDays\", \"resolvedAt\") values (?, ?, ?, 'SERVICE_DUE', 'Earlier', ?, 6, 'MONTH', 'CATEGORY', ?, "
                        + (resolved ? "now()" : "null") + ")",
                id,
                estateId,
                asset,
                dueOn,
                milestone);
        return id;
    }

    @Test
    void onlyTheNearestMilestoneFires() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(20));
        count("owner");
        assertEquals(1, due().size());
        assertEquals(30, open().getFirst().get("milestoneDays", Integer.class));
    }

    @Test
    void reachingANearerMilestoneReplacesTheOpenReminder() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(20));
        var earlier = earlierReminder(lamp, TODAY.plusDays(20), 60, false);
        count("owner").andExpect(jsonPath("$.unread").value(1));
        assertEquals(2, due().size());
        assertEquals(30, open().getFirst().get("milestoneDays", Integer.class));
        assertNotNull(db.fetchValue("select \"resolvedAt\" from \"Notification\" where id = ?", earlier));
    }

    @Test
    void aMilestoneIsNeverSentTwiceForTheSameDueDate() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(20));
        earlierReminder(lamp, TODAY.plusDays(20), 30, true);
        count("owner").andExpect(jsonPath("$.unread").value(0));
        assertEquals(1, due().size());
    }

    @Test
    void aNewDueDateStartsTheMilestonesAgain() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(20));
        earlierReminder(lamp, TODAY.minusMonths(6).plusDays(20), 30, true);
        count("owner").andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void anOpenReminderFromBeforeMilestonesIsMarkedNotResent() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(20));
        var earlier = earlierReminder(lamp, TODAY.plusDays(20), null, false);
        count("owner");
        assertEquals(1, due().size());
        assertEquals(
                30,
                ((Number) db.fetchValue("select \"milestoneDays\" from \"Notification\" where id = ?", earlier))
                        .intValue());
    }

    @Test
    void switchedOffServiceRemindersAreNotRaisedButStillResolve() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(5));
        lampDueOn("L-2", TODAY.plusDays(5));
        earlierReminder(lamp, TODAY.plusDays(5), 14, false);
        switches(false, true);
        count("owner");
        assertEquals(1, due().size());
        assertNull(open().getFirst().get("resolvedAt"));
        inspected(lamp, TODAY);
        nextDay();
        count("owner");
        assertEquals(0, open().size());
    }

    @Test
    void anOverdueAssetIsNotifiedAsOverdueAtTheFourteenDayMilestone() throws Exception {
        lampDueOn("L-1", TODAY.minusDays(3));
        count("owner");
        assertEquals(
                "Service overdue since " + DATE.format(TODAY.minusDays(3)),
                open().getFirst().get("summary"));
        assertEquals(14, open().getFirst().get("milestoneDays", Integer.class));
    }

    @Test
    void theClockCountsFromTheLastInspection() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.minusDays(30));
        inspected(lamp, TODAY.minusMonths(6).plusDays(5));
        count("owner");
        assertEquals(
                TODAY.minusMonths(6).plusDays(5).plusMonths(6),
                open().getFirst().get("dueOn", LocalDate.class));
    }

    @Test
    void anAssetOverrideIsLabelledAsSetOnTheAsset() throws Exception {
        var pump = asset("P-1", "PUMP", TODAY.minusDays(85));
        assetInterval(pump, 90, "DAY");
        count("owner");
        var notification = open().getFirst();
        assertEquals("ASSET", notification.get("intervalSource"));
        assertEquals(90, notification.get("intervalValue", Integer.class));
        assertEquals("DAY", notification.get("intervalUnit"));
    }

    @Test
    void assetsWithoutAnIntervalOrABaseDateAreSkipped() throws Exception {
        asset("P-1", "PUMP", TODAY.minusYears(5));
        asset("L-9", "LIGHTING", null);
        count("owner").andExpect(jsonPath("$.unread").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"OPEN", "ASSIGNED", "IN_PROGRESS"})
    void anOpenWorkOrderSuppressesTheNotification(String status) throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(5));
        workOrder(lamp, status);
        count("owner").andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void aClosedWorkOrderDoesNot() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(5));
        workOrder(lamp, "CLOSED");
        count("owner").andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void anAssetIsNotifiedOnceWhileItStaysDue() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(5));
        count("owner");
        nextDay();
        count("owner");
        assertEquals(1, due().size());
    }

    @Test
    void anInspectionResolvesTheNotificationOnTheNextSweep() throws Exception {
        var lamp = lampDueOn("L-1", TODAY.plusDays(5));
        count("owner");
        inspected(lamp, TODAY);
        nextDay();
        count("owner");
        assertEquals(1, due().size());
        assertNotNull(due().getFirst().get("resolvedAt"));
    }

    @Test
    void aNewWorkOrderOrRetirementResolvesIt() throws Exception {
        var ordered = lampDueOn("L-1", TODAY.plusDays(5));
        var retired = lampDueOn("L-2", TODAY.plusDays(5));
        var still = lampDueOn("L-3", TODAY.plusDays(5));
        count("owner");
        workOrder(ordered, "OPEN");
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", retired);
        nextDay();
        count("owner");
        assertEquals(1, open().size());
        assertEquals(still, open().getFirst().get("assetId"));
    }

    @Test
    void removingTheIntervalResolvesIt() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(5));
        count("owner");
        db.execute(
                "insert into \"AssetCategoryIntervalChange\" (id, \"estateId\", category, \"changedByUserId\", \"changedAt\") values (?, ?, 'LIGHTING', 'owner', now() + interval '1 second')",
                UUID.randomUUID(),
                estateId);
        nextDay();
        count("owner");
        assertNull(open().stream().findFirst().orElse(null));
    }

    @Test
    void anotherEstateIsUntouched() throws Exception {
        lampDueOn("L-1", TODAY.plusDays(5));
        var mine = estateId;
        estateId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'stranger', 'Other', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        count("owner");
        assertEquals(0, sweeps());
        estateId = mine;
        assertEquals(1, sweeps());
    }

    // ---- REPAIR_PREDICTED (ID-101) -----------------------------------------------------------------------------

    void breakdowns(UUID asset, int... daysAgo) {
        for (var days : daysAgo) {
            db.execute(
                    "insert into \"AssetEvent\" (id, \"estateId\", \"assetId\", type, \"occurredOn\", notes, \"recordedByUserId\") values (?, ?, ?, 'BREAKDOWN_REPAIR', ?, 'Repaired', 'owner')",
                    UUID.randomUUID(),
                    estateId,
                    asset,
                    TODAY.minusDays(days));
        }
    }

    /** P30 about 0.18: within 30 days (FailureRiskCalculatorTests). */
    UUID pumpWithin30Days(String reference) {
        var pump = asset(reference, "PUMP", TODAY.minusDays(165));
        breakdowns(pump, 145, 125, 105, 85, 65, 45, 25, 5);
        return pump;
    }

    /** P30 about 0.11, P60 about 0.20: within 60 days. */
    UUID pumpWithin60Days(String reference) {
        var pump = asset(reference, "PUMP", TODAY.minusDays(420));
        breakdowns(pump, 330, 240, 150, 60);
        return pump;
    }

    /** An open repair reminder raised before today at this milestone. */
    UUID earlierPrediction(UUID asset, Integer milestone) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"recommendedTimeframe\", probability, basis, \"failuresObserved\", \"milestoneDays\") values (?, ?, ?, 'REPAIR_PREDICTED', 'Earlier', 'WITHIN_90_DAYS', 0.3, 'ASSET_HISTORY', 4, ?)",
                id,
                estateId,
                asset,
                milestone);
        return id;
    }

    List<Record> predicted() {
        return db.fetch(
                "select * from \"Notification\" where \"estateId\" = ? and type = 'REPAIR_PREDICTED' order by \"resolvedAt\" nulls last, id",
                estateId);
    }

    @Test
    void aPumpPredictedWithinTheLeadWindowIsNotified() throws Exception {
        var pump = pumpWithin30Days("P-1");
        count("owner");
        var notification = predicted().getFirst();
        assertEquals(pump, notification.get("assetId"));
        assertEquals("WITHIN_30_DAYS", notification.get("recommendedTimeframe"));
        assertEquals("ASSET_HISTORY", notification.get("basis"));
        assertEquals(8, notification.get("failuresObserved", Integer.class));
        var probability =
                notification.get("probability", java.math.BigDecimal.class).doubleValue();
        assertEquals(0.18, probability, 0.01);
        assertEquals(
                "Repair likely within 30 days (" + Math.round(probability * 100) + "% chance)",
                notification.get("summary"));
        assertEquals(30, notification.get("milestoneDays", Integer.class));
    }

    @Test
    void aSixtyDayWindowIsNotifiedAtSixtyDays() throws Exception {
        pumpWithin60Days("P-1");
        count("owner");
        var notification = predicted().getFirst();
        assertEquals("WITHIN_60_DAYS", notification.get("recommendedTimeframe"));
        assertEquals(60, notification.get("milestoneDays", Integer.class));
        assertEquals(
                0.20,
                notification.get("probability", java.math.BigDecimal.class).doubleValue(),
                0.01);
    }

    @Test
    void aNearerWindowReplacesTheOpenReminder() throws Exception {
        var pump = pumpWithin30Days("P-1");
        earlierPrediction(pump, 60);
        count("owner");
        assertEquals(2, predicted().size());
        assertEquals(30, predicted().getFirst().get("milestoneDays", Integer.class));
        assertNull(predicted().getFirst().get("resolvedAt"));
        assertNotNull(predicted().get(1).get("resolvedAt"));
    }

    @Test
    void aRepairReminderNeverStepsBackwards() throws Exception {
        var pump = pumpWithin60Days("P-1");
        earlierPrediction(pump, 30);
        count("owner");
        assertEquals(1, predicted().size());
        assertEquals(30, predicted().getFirst().get("milestoneDays", Integer.class));
        assertNull(predicted().getFirst().get("resolvedAt"));
    }

    @Test
    void leavingTheWindowResolvesIt() throws Exception {
        var pump = pumpWithin60Days("P-1");
        count("owner");
        workOrder(pump, "OPEN");
        nextDay();
        count("owner");
        assertEquals(1, predicted().size());
        assertNotNull(predicted().getFirst().get("resolvedAt"));
    }

    @Test
    void switchedOffRepairRemindersAreNotRaised() throws Exception {
        switches(true, false);
        pumpWithin30Days("P-1");
        count("owner");
        assertEquals(0, predicted().size());
    }

    @Test
    void aPredictedPumpIsNotifiedOncePerCrossing() throws Exception {
        pumpWithin30Days("P-1");
        count("owner");
        nextDay();
        count("owner");
        assertEquals(1, predicted().size());
    }

    @Test
    void anOpenWorkOrderSuppressesThePrediction() throws Exception {
        workOrder(pumpWithin30Days("P-1"), "OPEN");
        count("owner");
        assertEquals(0, predicted().size());
    }

    @Test
    void aTypicalNewPumpIsNotPredicted() throws Exception {
        asset("P-1", "PUMP", TODAY);
        asset("P-2", "PUMP", null);
        count("owner");
        assertEquals(0, predicted().size());
    }
}
