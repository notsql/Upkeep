package com.proj.server;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateinvitation.ESTATEINVITATION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Real transactions/connections: wrapping these races in a test transaction would hide the fixtures. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CustomEstateRoleConcurrencyIntegrationTests extends CustomEstateRoleTestSupport {
    private String failureTriggerTable;

    @AfterEach
    void cleanCommittedFixtures() {
        if (estateId == null) return;
        if (failureTriggerTable != null) {
            if (!db.meta().getTables(failureTriggerTable).isEmpty()) {
                db.execute("drop trigger if exists custom_role_test_failure on \"" + failureTriggerTable + "\"");
            }
            db.execute("drop function if exists custom_role_test_failure()");
        }
        db.deleteFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId))
                .execute();
        db.deleteFrom(ESTATEUSER).where(ESTATEUSER.ESTATEID.eq(estateId)).execute();
        // These are disposable database fixtures, not application repository queries.
        if (!db.meta().getTables("EstateRoleDefinition").isEmpty()) {
            db.execute(
                    "delete from \"EstateRolePermission\" where \"roleId\" in (select id from \"EstateRoleDefinition\" where \"estateId\"=?)",
                    estateId);
            db.execute("delete from \"EstateRoleDefinition\" where \"estateId\"=?", estateId);
        }
        db.deleteFrom(ESTATE).where(ESTATE.ID.eq(estateId)).execute();
    }

    @Test
    void simultaneousCaseInsensitiveNamesCreateExactlyOneDefinition() throws Exception {
        var result = race(
                () -> send("owner", post(roles()), roleBody("Caretaker", "VIEW_ESTATE"))
                        .andReturn()
                        .getResponse()
                        .getStatus(),
                () -> send("manager", post(roles()), roleBody(" caretaker ", "VIEW_ESTATE"))
                        .andReturn()
                        .getResponse()
                        .getStatus());
        assertEquals(List.of(201, 409), result.stream().sorted().toList());
        mvc.perform(as("owner", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void simultaneousEditorsCannotOverwriteTheSameExpectedVersion() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var result = race(
                () -> send("owner", put(roles() + "/" + id(role)), updateBody(role, "First edit", "VIEW_ESTATE"))
                        .andReturn()
                        .getResponse()
                        .getStatus(),
                () -> send("manager", put(roles() + "/" + id(role)), updateBody(role, "Second edit", "VIEW_ESTATE"))
                        .andReturn()
                        .getResponse()
                        .getStatus());
        assertEquals(List.of(200, 409), result.stream().sorted().toList());
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[0].version").value(2));
    }

    @Test
    void assignmentAndDeletionSerializeSoNoMemberCanReferenceADeletedRole() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var result = race(
                () -> assign("owner", "member", role).andReturn().getResponse().getStatus(),
                () -> mvc.perform(as("manager", delete(roles() + "/" + id(role))))
                        .andReturn()
                        .getResponse()
                        .getStatus());
        assertTrue(
                result.equals(List.of(200, 409)) || result.equals(List.of(404, 204)),
                "assignment/delete statuses: " + result);
        if (result.getFirst() == 200) {
            mvc.perform(as("owner", get(roles())))
                    .andExpect(jsonPath("$[0].canDelete").value(false));
            mvc.perform(as("member", get(path()))).andExpect(status().isOk());
        } else {
            mvc.perform(as("owner", get(roles()))).andExpect(jsonPath("$").isEmpty());
            assertEquals(
                    "COUNCIL",
                    db.select(ESTATEUSER.ROLE)
                            .from(ESTATEUSER)
                            .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member")))
                            .fetchSingle(ESTATEUSER.ROLE));
        }
    }

    @Test
    void acceptanceAndDeletionEitherCreateMembershipAndBlockDeletionOrInvalidateTheOffer() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        var result =
                race(() -> accept(invitation, role).andReturn().getResponse().getStatus(), () -> mvc.perform(
                                as("owner", delete(roles() + "/" + id(role))))
                        .andReturn()
                        .getResponse()
                        .getStatus());
        assertTrue(
                result.equals(List.of(200, 409)) || result.equals(List.of(404, 204)),
                "accept/delete statuses: " + result);
        assertEquals(
                result.getFirst() == 200,
                db.fetchExists(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("recipient"))));
        if (result.get(1) == 204) {
            assertFalse(db.fetchExists(ESTATEINVITATION, ESTATEINVITATION.ID.eq(id(invitation))));
        }
    }

    @Test
    void aPermissionInsertFailureRollsBackTheWholeRoleCreation() throws Exception {
        failBefore("EstateRolePermission", "INSERT");
        send("owner", post(roles()), roleBody("Must roll back", "VIEW_ESTATE"))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(as("owner", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void aDefinitionDeleteFailureRollsBackInvitationAndPermissionLinkDeletions() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        failBefore("EstateRoleDefinition", "DELETE");
        mvc.perform(as("owner", delete(roles() + "/" + id(role)))).andExpect(status().isServiceUnavailable());
        assertTrue(db.fetchExists(ESTATEINVITATION, ESTATEINVITATION.ID.eq(id(invitation))));
        mvc.perform(as("owner", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].permissions", contains("VIEW_ESTATE")));
        accept(invitation, role).andExpect(status().isOk());
    }

    private void failBefore(String table, String operation) {
        // Fault injection is scoped to this throwaway test database and removed in @AfterEach.
        db.execute("""
                create function custom_role_test_failure() returns trigger language plpgsql as $$
                begin raise exception 'Injected custom-role storage failure'; end; $$
                """);
        failureTriggerTable = table;
        db.execute("create trigger custom_role_test_failure before " + operation + " on \"" + table
                + "\" for each row execute function custom_role_test_failure()");
    }

    private List<Integer> race(Callable<Integer> first, Callable<Integer> second) throws Exception {
        var barrier = new CyclicBarrier(2);
        var threads = Executors.newFixedThreadPool(2);
        try {
            var left = threads.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return first.call();
            });
            var right = threads.submit(() -> {
                barrier.await(10, TimeUnit.SECONDS);
                return second.call();
            });
            return List.of(left.get(20, TimeUnit.SECONDS), right.get(20, TimeUnit.SECONDS));
        } finally {
            threads.shutdownNow();
        }
    }
}
