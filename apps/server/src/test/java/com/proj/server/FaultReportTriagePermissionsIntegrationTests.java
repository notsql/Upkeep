package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Changing urgency, linking duplicates, changing type and dismissing need TRIAGE_FAULT_REPORTS; sending a report to a
 * contractor creates a work order and needs MANAGE_WORK_ORDERS (spec: estate-role-permissions).
 */
class FaultReportTriagePermissionsIntegrationTests extends AssetHistoryTestSupport {
    UUID level;
    UUID original;
    UUID report;

    @BeforeEach
    void reportsAwaitingReview() throws Exception {
        for (var user : List.of("viewer", "triager")) person(user, true);
        grant("viewer", "VIEW_FAULT_REPORTS");
        grant("triager", "VIEW_FAULT_REPORTS", "TRIAGE_FAULT_REPORTS");
        level = location(estateId, "LEVEL", locationId, "L1", 1);
        original = report(estateId, level, "resident");
        report = report(estateId, level, "resident");
        db.execute("""
                insert into "ReportRouting" ("reportId", "estateId", state, reason, "updatedAt")
                values (?, ?, 'NEEDS_REVIEW', 'Needs an on-site check', now())
                """, report, estateId);
    }

    private String reports() {
        return path() + "/reports/" + report;
    }

    private Map<String, Object> urgent() {
        return Map.of("urgency", "URGENT", "isSafety", false, "expectedVersion", 0);
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "crew", "triager"})
    void triagersChangeUrgencyTypeDuplicatesAndDismiss(String user) throws Exception {
        send(user, patch(reports() + "/urgency"), urgent()).andExpect(status().is2xxSuccessful());
        send(user, put(reports() + "/category"), Map.of("category", "WATER_LEAK"))
                .andExpect(status().is2xxSuccessful());
        send(user, put(reports() + "/duplicate"), Map.of("originalReportId", original))
                .andExpect(status().is2xxSuccessful());
        read(user, post(reports() + "/dismiss")).andExpect(status().is2xxSuccessful());
    }

    @ParameterizedTest
    @ValueSource(strings = {"viewer", "member", "resident"})
    void membersWithoutTriageCannotChangeReports(String user) throws Exception {
        send(user, patch(reports() + "/urgency"), urgent()).andExpect(status().isForbidden());
        send(user, put(reports() + "/category"), Map.of("category", "WATER_LEAK"))
                .andExpect(status().isForbidden());
        send(user, put(reports() + "/duplicate"), Map.of("originalReportId", original))
                .andExpect(status().isForbidden());
        read(user, post(reports() + "/dismiss")).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "triager"})
    void triageDoesNotIncludeSendingToAContractor(String user) throws Exception {
        send(user, post(reports() + "/work-order"), Map.of("equipmentType", "PLUMBING", "priority", "HIGH"))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        send("outsider", patch(reports() + "/urgency"), urgent()).andExpect(status().isNotFound());
        read("outsider", post(reports() + "/dismiss")).andExpect(status().isNotFound());
    }
}
