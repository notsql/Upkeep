package com.proj.server;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
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
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** Sending crew or a contractor to flagged equipment (spec equipment-dispatch.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EquipmentDispatchIntegrationTests {
    static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Singapore"));
    static final LocalDate MONTH = TODAY.withDayOfMonth(1);

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, blockA, pump;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        blockA = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                blockA,
                estateId);
        pump = asset("P-1");
        membership("manager", "MANAGER");
        membership("crew", "CREW");
        membership("council", "COUNCIL");
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Casey Doe"));
        when(workOS.findDisplayName("manager")).thenReturn(Optional.of("Morgan Lee"));
        when(workOS.findDisplayName("crew")).thenReturn(Optional.of("Ahmad Rahman"));
        when(workOS.findDisplayName("council")).thenReturn(Optional.of("Zed Council"));
    }

    UUID asset(String reference) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, ?, ?, 'PUMP', now())",
                id,
                estateId,
                blockA,
                reference,
                "Pump " + reference);
        return id;
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions send(String user, UUID asset, String body) throws Exception {
        return mvc.perform(post("/estates/" + estateId + "/assets/" + asset + "/inspection-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions sendTo(String assignee) throws Exception {
        return send("manager", pump, "{\"assignedToUserId\":\"" + assignee + "\"}");
    }

    ResultActions as(String user, String path) throws Exception {
        return mvc.perform(get(path).with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions record(String user, UUID asset, String outcome, String notes) throws Exception {
        var request = StoredUploadSubmission.inspection(
                        "/estates/" + estateId + "/assets/" + asset + "/inspections", null)
                .param("expectedLocationId", blockA.toString())
                .param("outcome", outcome)
                .param("inspectedOn", TODAY.toString());
        if (notes != null) request.param("notes", notes);
        return mvc.perform(request.with(jwt().jwt(j -> j.subject(user))));
    }

    int count(String sql) {
        return ((Number) db.fetchValue(sql, estateId)).intValue();
    }

    // --- Inspectors

    @Test
    void listsPeopleWhoCanRecordInspectionsSortedByName() throws Exception {
        as("manager", "/estates/" + estateId + "/inspectors")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("Ahmad Rahman", "Casey Doe", "Morgan Lee")))
                .andExpect(jsonPath("$[*].roleName", contains("Crew", "Owner", "Manager")))
                .andExpect(jsonPath("$[0].userId").value("crew"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "council"})
    void onlySendersCanListInspectors(String user) throws Exception {
        as(user, "/estates/" + estateId + "/inspectors").andExpect(status().is4xxClientError());
    }

    // --- Send crew to inspect

    @Test
    void sendingCrewOpensARequestedCheckForToday() throws Exception {
        sendTo("crew")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.assetId").value(pump.toString()))
                .andExpect(jsonPath("$.dueOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.dueBasis").value("REQUESTED"))
                .andExpect(jsonPath("$.status").value("DUE"))
                .andExpect(jsonPath("$.requestedByName").value("Morgan Lee"))
                .andExpect(jsonPath("$.assignedToName").value("Ahmad Rahman"));
        as("manager", "/estates/" + estateId + "/inspection-list")
                .andExpect(jsonPath("$.checks", hasSize(1)))
                .andExpect(jsonPath("$.checks[0].dueBasis").value("REQUESTED"))
                .andExpect(jsonPath("$.checks[0].assignedToName").value("Ahmad Rahman"))
                .andExpect(jsonPath("$.checks[0].requestedByName").value("Morgan Lee"));
    }

    @Test
    void sendingTwiceReturnsTheOpenCheckAndKeepsTheFirstChoice() throws Exception {
        var first = JsonPath.read(sendTo("crew").andReturn().getResponse().getContentAsString(), "$.id");
        sendTo("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first))
                .andExpect(jsonPath("$.assignedToName").value("Ahmad Rahman"));
        assertEquals(1, count("select count(*) from \"InspectionCheck\" where \"estateId\" = ?"));
        assertEquals(
                1, count("select count(*) from \"Notification\" where \"estateId\" = ? and type = 'CHECK_REQUESTED'"));
    }

    @Test
    void sendingAfterThisMonthsInspectionIsAConflict() throws Exception {
        sendTo("crew");
        record("crew", pump, "PASS", null).andExpect(status().isCreated());
        sendTo("crew")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"council", "stranger", " "})
    void theAssigneeMustBeAbleToRecordInspections(String assignee) throws Exception {
        sendTo(assignee).andExpect(status().isBadRequest());
        assertEquals(0, count("select count(*) from \"InspectionCheck\" where \"estateId\" = ?"));
    }

    @Test
    void aMissingAssigneeIsABadRequest() throws Exception {
        send("manager", pump, "{}").andExpect(status().isBadRequest());
    }

    @Test
    void crewCannotSendCrew() throws Exception {
        send("crew", pump, "{\"assignedToUserId\":\"crew\"}").andExpect(status().is4xxClientError());
        assertEquals(0, count("select count(*) from \"InspectionCheck\" where \"estateId\" = ?"));
    }

    @Test
    void anAssetOutsideTheEstateIsNotFound() throws Exception {
        send("manager", UUID.randomUUID(), "{\"assignedToUserId\":\"crew\"}").andExpect(status().isNotFound());
    }

    @Test
    void aRetiredAssetCannotBeSent() throws Exception {
        db.execute("update \"Asset\" set \"deactivatedAt\" = now(), \"retiredOn\" = current_date where id = ?", pump);
        sendTo("crew").andExpect(status().is4xxClientError());
        assertEquals(0, count("select count(*) from \"InspectionCheck\" where \"estateId\" = ?"));
    }

    @Test
    void anInactiveEstateCannotSend() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        sendTo("crew").andExpect(status().isConflict());
    }

    @Test
    void generatingTheMonthlyListSkipsARequestedCheck() throws Exception {
        sendTo("crew");
        db.execute(
                "insert into \"AssetCategoryFlagChange\" (id, \"estateId\", category, \"failsSilently\", \"changedByUserId\") values (?, ?, 'PUMP', true, 'owner')",
                UUID.randomUUID(),
                estateId);
        mvc.perform(post("/estates/" + estateId + "/inspection-list/generate")
                        .with(jwt().jwt(j -> j.subject("manager"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(0))
                .andExpect(jsonPath("$.list.checks", hasSize(1)))
                .andExpect(jsonPath("$.list.checks[0].dueBasis").value("REQUESTED"));
    }

    // --- The addressed notification

    @Test
    void onlyTheChosenPersonIsNotified() throws Exception {
        sendTo("crew");
        as("crew", "/notifications")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].type").value("CHECK_REQUESTED"))
                .andExpect(jsonPath("$.items[0].assetId").value(pump.toString()))
                .andExpect(jsonPath("$.items[0].resolvedAt").value(nullValue()));
        as("crew", "/notifications/unread-count").andExpect(jsonPath("$.unread").value(1));
        as("manager", "/notifications").andExpect(jsonPath("$.items", hasSize(0)));
        as("owner", "/notifications").andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void theNotificationDisappearsWhenThePersonLosesAccess() throws Exception {
        sendTo("crew");
        db.execute(
                "update \"EstateUser\" set role = 'COUNCIL' where \"estateId\" = ? and \"userId\" = 'crew'", estateId);
        as("crew", "/notifications").andExpect(jsonPath("$.items", hasSize(0)));
        as("crew", "/notifications/unread-count").andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void recordingTheInspectionCompletesTheCheckAndResolvesTheNotification() throws Exception {
        sendTo("crew");
        record("owner", pump, "PASS", null).andExpect(status().isCreated());
        as("crew", "/notifications").andExpect(jsonPath("$.items[0].resolvedAt").isNotEmpty());
        as("manager", "/estates/" + estateId + "/inspection-list")
                .andExpect(jsonPath("$.checks[0].status").value("DONE"));
    }

    // --- Crew found a problem

    @Test
    void aFailNeedsANote() throws Exception {
        record("crew", pump, "FAIL", null).andExpect(status().isBadRequest());
        record("crew", pump, "FAIL", "   ").andExpect(status().isBadRequest());
        record("crew", pump, "PASS", null).andExpect(status().isCreated());
    }

    @Test
    void aFailNotifiesTheManagers() throws Exception {
        var body = record("crew", pump, "FAIL", "Motor is grinding loudly")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String resultId = JsonPath.read(body, "$.id");
        as("manager", "/notifications")
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].type").value("CHECK_FAILED"))
                .andExpect(jsonPath("$.items[0].summary").value("Motor is grinding loudly"))
                .andExpect(jsonPath("$.items[0].inspectionResultId").value(resultId));
        as("owner", "/notifications").andExpect(jsonPath("$.items[0].type").value("CHECK_FAILED"));
        as("crew", "/notifications").andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void aLongFailNoteIsShortenedInTheSummary() throws Exception {
        record("crew", pump, "FAIL", "x".repeat(2000)).andExpect(status().isCreated());
        var summary = (String) db.fetchValue(
                "select summary from \"Notification\" where \"estateId\" = ? and type = 'CHECK_FAILED'", estateId);
        assertEquals(300, summary.length());
    }

    @Test
    void aNewerInspectionReplacesTheOpenFailNotification() throws Exception {
        record("crew", pump, "FAIL", "Leaking").andExpect(status().isCreated());
        record("crew", pump, "FAIL", "Still leaking").andExpect(status().isCreated());
        as("manager", "/notifications")
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[?(@.resolvedAt == null)].summary", contains("Still leaking")));
        record("crew", pump, "PASS", null).andExpect(status().isCreated());
        as("manager", "/notifications").andExpect(jsonPath("$.items[?(@.resolvedAt == null)]", hasSize(0)));
    }

    @Test
    void aPassSendsNoNotification() throws Exception {
        record("crew", pump, "PASS", "All good").andExpect(status().isCreated());
        assertEquals(0, count("select count(*) from \"Notification\" where \"estateId\" = ?"));
    }

    // --- Open work order

    void workOrder(String reference, String status) {
        db.execute(
                "insert into \"WorkOrder\" (id, \"estateId\", reference, description, \"locationId\", \"assetId\", category, priority, source, status, \"createdByUserId\", \"updatedAt\") values (?, ?, ?, 'Fix it', ?, ?, 'EQUIPMENT_FAULT', 'MEDIUM', 'MANUAL', ?, 'owner', now())",
                UUID.randomUUID(),
                estateId,
                reference,
                blockA,
                pump,
                status);
    }

    String openWorkOrder() {
        return "/estates/" + estateId + "/assets/" + pump + "/open-work-order";
    }

    @Test
    void noOpenWorkOrderIsNoContent() throws Exception {
        workOrder("WO-1", "CLOSED");
        as("manager", openWorkOrder())
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    @Test
    void returnsTheAssetsOpenWorkOrder() throws Exception {
        workOrder("WO-1", "CLOSED");
        workOrder("WO-2", "IN_PROGRESS");
        as("crew", openWorkOrder())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reference").value("WO-2"))
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    void councilCannotReadTheOpenWorkOrder() throws Exception {
        as("council", openWorkOrder()).andExpect(status().is4xxClientError());
    }
}
