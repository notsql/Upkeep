package com.proj.server;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

class InspectionCrewAccessIntegrationTests extends InspectionTestSupport {
    @Test
    void crewCanBrowseAssignedEstatesAndInspectionAssetsWithoutManagementAuthority() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        read("/estates", "crew").andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem(data[0].toString())));
        read("/estates/" + data[0], "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(false));
        read("/estates/" + data[0] + "/inspection-assets", "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(data[2].toString()));
        read("/access/context", "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewEstateDetails").value(true))
                .andExpect(jsonPath("$.estates[0].canViewInspectionResults").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateInspectionResults").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateWorkOrders").value(false))
                .andExpect(jsonPath("$.estates[0].canManageEstate").value(false))
                .andExpect(jsonPath("$.estates[0].canViewAssets").value(false))
                .andExpect(jsonPath("$.estates[0].canViewManagement").value(false))
                .andExpect(jsonPath("$.estates[0].canUpdateWorkOrders").value(false));
    }

    @ParameterizedTest
    @CsvSource({
        "PATCH, '', '{\"name\":\"Changed\",\"code\":\"CHANGED\",\"address\":\"Road\",\"postalCode\":\"123456\"}', 403",
        "POST, /deactivate, '{\"code\":\"%s\"}', 403",
        "POST, /ownership-transfer, '{\"newOwnerUserId\":\"other\"}', 403",
        "POST, /locations, '{\"type\":\"BLOCK\",\"name\":\"New block\"}', 404",
        "DELETE, /members/other, '{}', 403",
        "PUT, /members/other/role, '{\"role\":\"MANAGER\"}', 403"
    })
    void estateReadAccessNeverGrantsCrewMutationAuthority(String method, String suffix, String body, int expectedStatus)
            throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        member(data[0], "other", "CREW");
        var before = db.fetchOne("select * from \"Estate\" where id=?", data[0]).intoMap();
        mvc.perform(request(HttpMethod.valueOf(method), "/estates/" + data[0] + suffix)
                        .with(jwt().jwt(t -> t.subject("crew")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.formatted(data[0])))
                .andExpect(status().is(expectedStatus));
        assertEquals(
                before,
                db.fetchOne("select * from \"Estate\" where id=?", data[0]).intoMap());
    }

    @Test
    void crewCannotCreateManualOrLegacyInspectionOrdersOrUpdateExistingOrders() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        read("/estates/" + data[0] + "/work-order-assets", "crew").andExpect(status().isForbidden());
        for (String source : List.of("MANUAL", "INSPECTION")) {
            mvc.perform(post("/estates/" + data[0] + "/work-orders")
                            .with(jwt().jwt(t -> t.subject("crew")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                            {"description":"Check seal","locationId":"%s","assetId":"%s","category":"EQUIPMENT_FAULT",
                            "priority":"HIGH","source":"%s","sourceReference":"Check on Monday"}
                            """.formatted(data[1], data[2], source)))
                    .andExpect(status().isForbidden());
        }
        assertEquals(0, count("WorkOrder", data[0]));
        String orderId = id(mvc.perform(post("/estates/" + data[0] + "/work-orders")
                        .with(jwt().jwt(t -> t.subject(OWNER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"description":"Check seal","locationId":"%s","category":"EQUIPMENT_FAULT",
                                "priority":"HIGH","source":"MANUAL"}
                                """.formatted(data[1])))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
        var path = "/estates/" + data[0] + "/work-orders/" + orderId;
        mvc.perform(patch(path + "/status")
                        .with(jwt().jwt(t -> t.subject("crew")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetStatus\":\"IN_PROGRESS\",\"expectedVersion\":0}"))
                .andExpect(status().isForbidden());
        mvc.perform(
                        put(path + "/completion")
                                .with(jwt().jwt(t -> t.subject("crew")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expectedVersion\":0,\"findings\":\"Worn seal\",\"workPerformed\":\"Replaced seal\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void inactiveEstateRetainsCrewReadsAndDisablesCreationCapabilities() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
        read("/estates/" + data[0], "crew").andExpect(status().isOk());
        read("/access/context", "crew")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewEstateDetails").value(true))
                .andExpect(jsonPath("$.estates[0].canViewInspectionResults").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateInspectionResults").value(false))
                .andExpect(jsonPath("$.estates[0].canCreateWorkOrders").value(false));
    }

    @Test
    void removalImmediatelyRevokesCrewEstateReadsAndAllCreationRights() throws Exception {
        var data = asset();
        member(data[0], "crew", "CREW");
        read("/estates/" + data[0], "crew").andExpect(status().isOk());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='crew'", data[0]);
        read("/estates/" + data[0], "crew").andExpect(status().isNotFound());
        read("/estates/" + data[0] + "/work-order-assets", "crew").andExpect(status().isNotFound());
        save(data, "crew", "PASS").andExpect(status().isNotFound());
    }
}
