package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** The access context's new flags follow each role's permission codes (spec: estate-role-permissions, Phase 5). */
class AccessContextFlagsIntegrationTests extends CustomEstateRoleTestSupport {
    static final List<String> FLAGS = List.of(
            "canEditAssets",
            "canViewCosts",
            "canViewDevices",
            "canManageDevices",
            "canManageInspections",
            "canProgressAssignedWorkOrders",
            "canTriageFaultReports");

    @BeforeEach
    void crew() {
        member(estateId, "crew", "CREW");
        person("crew", true);
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({
        // user,   edit assets, costs, view devices, manage devices, manage inspections, progress assigned, triage
        "owner,    true,  true,  true,  true,  true,  true,  true",
        "manager,  true,  true,  true,  true,  true,  true,  true",
        "member,   true,  true,  true,  false, false, false, false",
        "crew,     false, false, false, false, false, true,  true"
    })
    void eachRoleSeesItsOwnFlags(
            String user,
            boolean editAssets,
            boolean costs,
            boolean viewDevices,
            boolean manageDevices,
            boolean manageInspections,
            boolean progressAssigned,
            boolean triage)
            throws Exception {
        var estate =
                ownEstate(body(mvc.perform(as(user, get("/access/context"))).andExpect(status().isOk())));
        var expected =
                List.of(editAssets, costs, viewDevices, manageDevices, manageInspections, progressAssigned, triage);
        for (int i = 0; i < FLAGS.size(); i++) {
            assertEquals(expected.get(i), estate.path(FLAGS.get(i)).asBoolean(false), user + " " + FLAGS.get(i));
            assertEquals(true, estate.has(FLAGS.get(i)), "missing " + FLAGS.get(i));
        }
    }

    @ParameterizedTest
    @CsvSource({"owner", "manager", "member", "crew"})
    void writeFlagsAreOffInAnInactiveEstate(String user) throws Exception {
        inactive();
        var estate =
                ownEstate(body(mvc.perform(as(user, get("/access/context"))).andExpect(status().isOk())));
        for (var flag : List.of(
                "canEditAssets",
                "canManageDevices",
                "canManageInspections",
                "canProgressAssignedWorkOrders",
                "canTriageFaultReports")) {
            assertEquals(false, estate.path(flag).asBoolean(true), user + " " + flag);
        }
    }
}
