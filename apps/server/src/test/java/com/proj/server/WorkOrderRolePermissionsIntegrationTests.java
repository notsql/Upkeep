package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Work orders follow VIEW_WORK_ORDERS, PROGRESS_ASSIGNED_WORK_ORDERS and MANAGE_WORK_ORDERS (spec:
 * estate-role-permissions). Managers manage; Crew view and progress what is assigned to them; Council hold none.
 */
class WorkOrderRolePermissionsIntegrationTests extends AssetHistoryTestSupport {
    UUID order;

    @BeforeEach
    void orderAndCustomRoles() throws Exception {
        for (var user : List.of("viewer", "worker", "coordinator")) person(user, true);
        grant("viewer", "VIEW_WORK_ORDERS");
        grant("worker", "VIEW_WORK_ORDERS", "PROGRESS_ASSIGNED_WORK_ORDERS");
        grant("coordinator", "VIEW_WORK_ORDERS", "MANAGE_WORK_ORDERS");
        order = workOrder(estateId, assetId, locationId);
    }

    private void assignTo(String user) {
        db.execute(
                "update \"WorkOrder\" set \"assigneeUserId\"=?, \"assigneeName\"=?, \"assignedAt\"=now() where id=?",
                user,
                user,
                order);
    }

    private Map<String, Object> newOrder() {
        return Map.of(
                "description",
                "Repair",
                "locationId",
                locationId,
                "category",
                "CLEANLINESS",
                "priority",
                "MEDIUM",
                "source",
                "MANUAL");
    }

    private Map<String, Object> start() {
        return Map.of("targetStatus", "IN_PROGRESS", "expectedVersion", 0);
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "crew", "viewer", "worker", "coordinator"})
    void workOrderViewersSeeOrdersAndContractors(String user) throws Exception {
        read(user, get(path() + "/work-orders")).andExpect(status().isOk());
        read(user, get(path() + "/work-orders/" + order)).andExpect(status().isOk());
        read(user, get(path() + "/contractors")).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "resident"})
    void membersWithoutViewWorkOrdersAreRefused(String user) throws Exception {
        read(user, get(path() + "/work-orders")).andExpect(status().isForbidden());
        read(user, get(path() + "/work-orders/" + order)).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "coordinator"})
    void workOrderManagersCreateAndProgressAnyOrder(String user) throws Exception {
        send(user, post(path() + "/work-orders"), newOrder()).andExpect(status().isCreated());
        read(user, get(path() + "/work-orders/" + order))
                .andExpect(jsonPath("$.canProgress").value(true));
        send(user, patch(path() + "/work-orders/" + order + "/status"), start()).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "viewer", "worker"})
    void membersWithoutManageWorkOrdersCannotCreate(String user) throws Exception {
        send(user, post(path() + "/work-orders"), newOrder()).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "worker"})
    void assignedWorkersProgressOnlyTheirOwnOrders(String user) throws Exception {
        read(user, get(path() + "/work-orders/" + order))
                .andExpect(jsonPath("$.canProgress").value(false));
        send(user, patch(path() + "/work-orders/" + order + "/status"), start()).andExpect(status().isForbidden());
        assignTo(user);
        read(user, get(path() + "/work-orders/" + order))
                .andExpect(jsonPath("$.canProgress").value(true));
        send(user, patch(path() + "/work-orders/" + order + "/status"), start()).andExpect(status().isOk());
    }

    @Test
    void aViewerCannotProgressEvenAnOrderAssignedToThem() throws Exception {
        assignTo("viewer");
        read("viewer", get(path() + "/work-orders/" + order))
                .andExpect(jsonPath("$.canProgress").value(false));
        send("viewer", patch(path() + "/work-orders/" + order + "/status"), start())
                .andExpect(status().isForbidden());
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        read("outsider", get(path() + "/work-orders")).andExpect(status().isNotFound());
        send("outsider", post(path() + "/work-orders"), newOrder()).andExpect(status().isNotFound());
    }
}
