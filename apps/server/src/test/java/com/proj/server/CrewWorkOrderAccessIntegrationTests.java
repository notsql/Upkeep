package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class CrewWorkOrderAccessIntegrationTests extends InspectionTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"MANUAL", "RESIDENT_REPORT", "INSPECTION", "MAINTENANCE_RECOMMENDATION"})
    void crewCannotCreateFromAnySourceAndDeniedWritesLeaveSourcesIntact(String source) throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        String inspection = id(save(data, "crew", "FAIL")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
        var report = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReport\" (id,\"estateId\",\"locationId\",\"submittedByUserId\",title,description,\"updatedAt\") values (?,?,?,'resident','Leak','Leak',now())",
                report,
                data[0],
                data[1]);
        String extra =
                switch (source) {
                    case "RESIDENT_REPORT" ->
                        ",\"sourceReportId\":\"" + report + "\",\"expectedSourceLocationId\":\"" + data[1] + "\"";
                    case "INSPECTION" ->
                        ",\"sourceInspectionId\":\"" + inspection + "\",\"expectedSourceLocationId\":\"" + data[1]
                                + "\"";
                    case "MAINTENANCE_RECOMMENDATION" -> ",\"sourceReference\":\"Replace worn seal\"";
                    default -> "";
                };
        var before =
                db.fetchOne("select * from \"IssueReport\" where id=?", report).intoMap();
        create(data, "crew", source, extra).andExpect(status().isForbidden());
        assertEquals(0, count("WorkOrder", data[0]));
        assertEquals(0, count("WorkOrderStatusEvent", data[0]));
        assertEquals(
                before,
                db.fetchOne("select * from \"IssueReport\" where id=?", report).intoMap());
        read(inspections(data) + "/" + inspection, "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("FAIL"))
                .andExpect(jsonPath("$.workOrder").isEmpty());
    }

    @Test
    void crewCapabilitiesAreReadOnlyWhileInspectionRecordingRemainsAvailable() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        read("/access/context", "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewWorkOrders").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateWorkOrders").value(false))
                .andExpect(jsonPath("$.estates[0].canUpdateWorkOrders").value(false))
                .andExpect(jsonPath("$.estates[0].canCreateInspectionResults").value(true));
    }

    @Test
    void crewCannotUseTheCreationOnlyAssetPicker() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        read("/estates/" + data[0] + "/work-order-assets", "crew").andExpect(status().isForbidden());
        read("/estates/" + data[0] + "/inspection-assets", "crew").andExpect(status().isOk());
    }

    @Test
    void managerAuthorityInAnotherEstateDoesNotAllowCrewCreation() throws Exception {
        var managed = asset();
        var assigned = asset();
        member(managed[0], "staff", "MANAGER");
        member(assigned[0], "staff", "CREW");
        create(managed, "staff", "MANUAL", "").andExpect(status().isCreated());
        create(assigned, "staff", "MANUAL", "").andExpect(status().isForbidden());
        read("/estates/" + managed[0] + "/work-orders", "staff").andExpect(status().isOk());
        read("/estates/" + assigned[0] + "/work-orders", "staff").andExpect(status().isOk());
        assertEquals(0, count("WorkOrder", assigned[0]));
    }

    @Test
    void demotedManagerKeepsOrderReadsButImmediatelyLosesCreation() throws Exception {
        var data = asset();
        member(data[0], "staff", "MANAGER");
        String order = id(create(data, "staff", "MANUAL", "")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
        db.execute("update \"EstateUser\" set role='CREW' where \"estateId\"=? and \"userId\"='staff'", data[0]);
        create(data, "staff", "MANUAL", "").andExpect(status().isForbidden());
        read("/estates/" + data[0] + "/work-orders/" + order, "staff")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdByUserId").value("staff"));
        assertEquals(1, count("WorkOrder", data[0]));
    }

    @Test
    void anOwnerCanConvertACrewRecordedFailure() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        String inspection = id(save(data, "crew", "FAIL")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
        create(
                        data,
                        OWNER,
                        "INSPECTION",
                        ",\"sourceInspectionId\":\"" + inspection + "\",\"expectedSourceLocationId\":\"" + data[1]
                                + "\"")
                .andExpect(status().isCreated());
        read(inspections(data) + "/" + inspection, "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recordedByUserId").value("crew"))
                .andExpect(jsonPath("$.workOrder.reference").isString());
    }

    private ResultActions create(UUID[] data, String user, String source, String extra) throws Exception {
        return mvc.perform(post("/estates/" + data[0] + "/work-orders")
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"description":"Repair seal","locationId":"%s","assetId":"%s","category":"EQUIPMENT_FAULT",
                        "priority":"HIGH","source":"%s"%s}
                        """.formatted(data[1], data[2], source, extra)));
    }
}
