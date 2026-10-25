package com.proj.server;

import static com.proj.server.db.tables.Estateinvitation.ESTATEINVITATION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.estate.CouncilIdentity;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Custom offers keep their definition identity through dispatch, edits, acceptance and removal. */
class CustomEstateRoleInvitationsIntegrationTests extends CustomEstateRoleTestSupport {
    @Test
    void inAppAcceptanceGrantsExactlyTheOfferedRoleWithoutAnIntermediatePreset() throws Exception {
        var role = create("Report reader", "VIEW_FAULT_REPORTS");
        var invitation = invite("manager", role);
        assertFalse(hasRecipient());
        mvc.perform(as("recipient", get("/council-invitations")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].customRoleId").value(id(role).toString()))
                .andExpect(jsonPath("$[0].customRoleName").value("Report reader"))
                .andExpect(jsonPath("$[0].customPermissions[0].code").value("VIEW_FAULT_REPORTS"))
                .andExpect(jsonPath("$[0].customPermissions[0].description").isNotEmpty());
        assertFalse(hasRecipient());
        mvc.perform(as("recipient", get(roles()))).andExpect(status().isNotFound());
        accept(invitation, role)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds", contains(estateId.toString())));
        mvc.perform(as("owner", get(path() + "/members")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == 'recipient')].role", contains("CUSTOM")))
                .andExpect(jsonPath("$[?(@.userId == 'recipient')].customRoleId", contains(id(role).toString())));
        mvc.perform(as("recipient", get(path() + "/reports"))).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path()))).andExpect(status().isForbidden());
        accept(invitation, role).andExpect(status().isConflict());
        assertEquals(
                1, db.fetchCount(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("recipient"))));
        verify(identity, never()).invitation(anyString());
    }

    @Test
    void verifiedEmailReconciliationActivatesTheLatestEditedDefinitionWithoutAnExplicitBody() throws Exception {
        emailDelivery();
        var role = create("Reader", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        assertEquals("PENDING", invitation.get("status").asText());
        assertFalse(hasRecipient());
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Report reader", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isOk());
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "recipient@example.com",
                        "accepted",
                        OffsetDateTime.now().plusDays(7),
                        "recipient",
                        OffsetDateTime.now()));
        mvc.perform(as("recipient", post("/council-invitations/accept")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds", contains(estateId.toString())));
        mvc.perform(as("recipient", get(path() + "/reports"))).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path()))).andExpect(status().isForbidden());
    }

    @Test
    void explicitAcceptanceRequiresTheCurrentPreviewAfterTheRoleChanges() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        var updated = body(
                send("owner", put(roles() + "/" + id(role)), updateBody(role, "Report reader", "VIEW_FAULT_REPORTS"))
                        .andExpect(status().isOk()));
        mvc.perform(as("recipient", get("/council-invitations")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].customRoleVersion").value(2))
                .andExpect(jsonPath("$[0].customRoleName").value("Report reader"))
                .andExpect(jsonPath("$[0].customPermissions[*].code", contains("VIEW_FAULT_REPORTS")));
        accept(invitation, role).andExpect(status().isConflict());
        assertFalse(hasRecipient());
        accept(invitation, updated).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path() + "/reports"))).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"expectedRoleVersion\":0}",
                "{\"expectedRoleVersion\":-1}",
                "{\"expectedRoleVersion\":null}"
            })
    void explicitCustomAcceptanceRejectsMissingOrInvalidVersions(String payload) throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        mvc.perform(as(
                        "recipient",
                        post("/council-invitations/" + id(invitation) + "/accept")
                                .contentType("application/json")
                                .content(payload)))
                .andExpect(status().isBadRequest());
        assertFalse(hasRecipient());
    }

    @Test
    void invitationSendAndMemberAssignmentRejectAStaleRolePreviewWithoutDispatching() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Changed", "VIEW_ESTATE"))
                .andExpect(status().isOk());
        send("manager", post(path() + "/council-invitations"), offer(role, "recipient@example.com"))
                .andExpect(status().isConflict());
        assign("manager", "member", role).andExpect(status().isConflict());
        verify(identity, never()).send(any(), anyString(), anyString());
        assertEquals(0, db.fetchCount(ESTATEINVITATION, ESTATEINVITATION.ESTATEID.eq(estateId)));
    }

    @Test
    void delegatedInvitersCanOfferOnlyEqualOrSubsetCustomRolesAndCannotSeeTheRoster() throws Exception {
        var own = grant("author", "INVITE_MEMBERS", "VIEW_FAULT_REPORTS");
        var subset = create("Reader", "VIEW_FAULT_REPORTS");
        var stronger = create("Editor", "VIEW_ESTATE", "EDIT_ESTATE");
        mvc.perform(as("author", get(path() + "/invitation-roles")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$[*].customRoleId",
                        containsInAnyOrder(id(own).toString(), id(subset).toString())))
                .andExpect(jsonPath("$[*].role", everyItem(is("CUSTOM"))));
        invite("author", subset);
        send("author", post(path() + "/council-invitations"), offer(own, "equal@example.com"))
                .andExpect(status().isCreated());
        send("author", post(path() + "/council-invitations"), offer(stronger, "strong@example.com"))
                .andExpect(status().isForbidden());
        send("author", post(path() + "/council-invitations"), Map.of("email", "preset@example.com", "role", "MANAGER"))
                .andExpect(status().isForbidden());
        mvc.perform(as("author", get(path() + "/members"))).andExpect(status().isForbidden());
        mvc.perform(as("author", get(roles()))).andExpect(status().isForbidden());
        assign("author", "member", subset).andExpect(status().isForbidden());
    }

    @Test
    void delegatedInvitersListAndCancelOnlyTheirOwnOffers() throws Exception {
        grant("author", "INVITE_MEMBERS", "VIEW_FAULT_REPORTS");
        var target = create("Reader", "VIEW_FAULT_REPORTS");
        var own = invite("author", target);
        var other = body(send("manager", post(path() + "/council-invitations"), offer(target, "other@example.com"))
                .andExpect(status().isCreated()));
        mvc.perform(as("author", get(path() + "/council-invitations")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains(id(own).toString())));
        mvc.perform(as("author", delete(path() + "/council-invitations/" + id(other))))
                .andExpect(status().isNotFound());
        mvc.perform(as("author", delete(path() + "/council-invitations/" + id(own))))
                .andExpect(status().isNoContent());
        mvc.perform(as("author", delete(path() + "/council-invitations/" + id(own))))
                .andExpect(status().isNoContent());
        mvc.perform(as("manager", get(path() + "/council-invitations")))
                .andExpect(jsonPath("$[*].id", contains(id(other).toString())));
        accept(own, target).andExpect(status().isConflict());
        assertFalse(hasRecipient());
    }

    @Test
    void retainedOffersSurviveManagerDemotionAndAcceptedMembersRemainIndependent() throws Exception {
        var offered = create("Reader", "VIEW_FAULT_REPORTS");
        var invitation = invite("manager", offered);
        var demoted = create("No invitation power", "VIEW_ESTATE");
        assign("owner", "manager", demoted).andExpect(status().isOk());
        send("manager", post(path() + "/council-invitations"), offer(offered, "another@example.com"))
                .andExpect(status().isForbidden());
        accept(invitation, offered).andExpect(status().isOk());
        mvc.perform(as("owner", delete(path() + "/members/manager"))).andExpect(status().isNoContent());
        mvc.perform(as("recipient", get(path() + "/reports"))).andExpect(status().isOk());
    }

    @Test
    void removingTheDemotedInviterStillCancelsUnacceptedOffers() throws Exception {
        var role = create("Reader", "VIEW_FAULT_REPORTS");
        var invitation = invite("manager", role);
        assign("owner", "manager", create("Demoted", "VIEW_ESTATE")).andExpect(status().isOk());
        mvc.perform(as("owner", delete(path() + "/members/manager"))).andExpect(status().isNoContent());
        accept(invitation, role).andExpect(status().isConflict());
        assertFalse(hasRecipient());
    }

    @Test
    void anAuthorizedRoleEditCanIncreaseAPendingOfferBeyondItsInvitersCurrentPermissions() throws Exception {
        grant("author", "INVITE_MEMBERS", "VIEW_FAULT_REPORTS");
        var offered = create("Reader", "VIEW_FAULT_REPORTS");
        var invitation = invite("author", offered);
        var updated = body(send(
                        "owner",
                        put(roles() + "/" + id(offered)),
                        updateBody(offered, "Broader reader", "VIEW_FAULT_REPORTS", "VIEW_ESTATE"))
                .andExpect(status().isOk()));
        accept(invitation, updated).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path()))).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path() + "/reports"))).andExpect(status().isOk());
        send("author", post(path() + "/council-invitations"), offer(updated, "next@example.com"))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"wrong-recipient", "unverified", "expired", "inactive", "already-member"})
    void invalidAcceptanceNeverCreatesOrOverwritesMembership(String condition) throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        int expected = 409;
        String caller = "recipient";
        switch (condition) {
            case "wrong-recipient" -> {
                caller = "other";
                expected = 404;
            }
            case "unverified" -> {
                person("recipient", false);
                expected = 403;
            }
            case "expired" ->
                db.update(ESTATEINVITATION)
                        .set(ESTATEINVITATION.EXPIRESAT, OffsetDateTime.now().minusDays(1))
                        .where(ESTATEINVITATION.ID.eq(id(invitation)))
                        .execute();
            case "inactive" -> inactive();
            case "already-member" -> member(estateId, "recipient", "CREW");
            default -> throw new IllegalArgumentException(condition);
        }
        send(caller, post("/council-invitations/" + id(invitation) + "/accept"), Map.of("expectedRoleVersion", 1))
                .andExpect(status().is(expected));
        if (condition.equals("already-member")) {
            assertEquals(
                    "CREW",
                    db.select(ESTATEUSER.ROLE)
                            .from(ESTATEUSER)
                            .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("recipient")))
                            .fetchSingle(ESTATEUSER.ROLE));
        } else assertFalse(hasRecipient());
    }

    @Test
    void aSendingRetryCannotSwitchCustomDefinitionsAndMustRefreshTheRoleVersion() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var other = create("Other reader", "VIEW_FAULT_REPORTS");
        when(identity.send(any(), anyString(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Provider unavailable."));
        send("manager", post(path() + "/council-invitations"), offer(role, "recipient@example.com"))
                .andExpect(status().isBadGateway());
        var reserved = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId))
                .fetchSingle();
        send("manager", post(path() + "/council-invitations"), offer(other, "recipient@example.com"))
                .andExpect(status().isConflict());
        var updated = body(send("owner", put(roles() + "/" + id(role)), updateBody(role, "Changed", "VIEW_ESTATE"))
                .andExpect(status().isOk()));
        send("manager", post(path() + "/council-invitations"), offer(role, "recipient@example.com"))
                .andExpect(status().isConflict());
        org.mockito.Mockito.doAnswer(call -> new CouncilIdentity.Invitation(
                        null,
                        call.getArgument(1),
                        "existing_account",
                        OffsetDateTime.now().plusDays(7),
                        null,
                        null))
                .when(identity)
                .send(any(), anyString(), anyString());
        send("manager", post(path() + "/council-invitations"), offer(updated, "recipient@example.com"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(reserved.getId().toString()))
                .andExpect(jsonPath("$.customRoleId").value(id(role).toString()));
    }

    @Test
    void deletingAnUnusedRolePermanentlyRemovesOffersOfEveryStatusAndInvalidatesOldLinks() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var retainedRole = create("Retained", "VIEW_FAULT_REPORTS");
        var retained = invite("manager", retainedRole);
        var ids = new java.util.ArrayList<UUID>();
        for (var state : List.of("SENDING", "PENDING", "IN_APP", "ACCEPTED", "CANCELLED", "EXPIRED")) {
            var invitation = body(send(
                            "manager",
                            post(path() + "/council-invitations"),
                            offer(role, state.toLowerCase() + "@example.com"))
                    .andExpect(status().isCreated()));
            ids.add(id(invitation));
            db.update(ESTATEINVITATION)
                    .set(ESTATEINVITATION.STATUS, state.equals("EXPIRED") ? "IN_APP" : state)
                    .set(
                            ESTATEINVITATION.EXPIRESAT,
                            state.equals("EXPIRED")
                                    ? OffsetDateTime.now().minusDays(1)
                                    : OffsetDateTime.now().plusDays(1))
                    .where(ESTATEINVITATION.ID.eq(id(invitation)))
                    .execute();
        }
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[?(@.id == '" + id(role) + "')].canDelete", contains(true)));
        mvc.perform(as("manager", delete(roles() + "/" + id(role)))).andExpect(status().isNoContent());
        assertEquals(0, db.fetchCount(ESTATEINVITATION, ESTATEINVITATION.ID.in(ids)));
        assertTrue(db.fetchExists(ESTATEINVITATION, ESTATEINVITATION.ID.eq(id(retained))));
        // Accepted invitation history disappears without removing already reassigned members.
        assertTrue(db.fetchExists(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member"))));
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[*].id", contains(id(retainedRole).toString())));
        for (var old : ids) {
            send("recipient", post("/council-invitations/" + old + "/accept"), Map.of("expectedRoleVersion", 1))
                    .andExpect(status().isNotFound());
        }
        send("manager", post(path() + "/council-invitations"), offer(role, "new@example.com"))
                .andExpect(status().isNotFound());
        mvc.perform(as("owner", get(path() + "/role-permissions")))
                .andExpect(jsonPath("$.length()").value(11));
        assertFalse(hasRecipient());
    }

    @Test
    void assignedMembersBlockDeletionWithoutDeletingAnyPendingInvitations() throws Exception {
        var role = grant("member", "VIEW_ESTATE");
        var invitation = invite("manager", role);
        mvc.perform(as("owner", delete(roles() + "/" + id(role)))).andExpect(status().isConflict());
        assertTrue(db.fetchExists(ESTATEINVITATION, ESTATEINVITATION.ID.eq(id(invitation))));
        accept(invitation, role).andExpect(status().isOk());
    }

    @Test
    void lateProviderFinalizationCannotRecreateAnInvitationDeletedWithItsRole() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        var sentId = new java.util.concurrent.atomic.AtomicReference<UUID>();
        when(identity.send(any(), anyString(), anyString())).thenAnswer(call -> {
            sentId.set(call.getArgument(0));
            mvc.perform(as("owner", delete(roles() + "/" + id(role)))).andExpect(status().isNoContent());
            return new CouncilIdentity.Invitation(
                    "provider-late",
                    call.getArgument(1),
                    "pending",
                    OffsetDateTime.now().plusDays(7),
                    null,
                    null);
        });
        send("manager", post(path() + "/council-invitations"), offer(role, "recipient@example.com"))
                .andExpect(status().isConflict());
        assertNotNull(sentId.get());
        assertFalse(db.fetchExists(ESTATEINVITATION, ESTATEINVITATION.ID.eq(sentId.get())));
        assertFalse(hasRecipient());
        mvc.perform(as("owner", get(roles()))).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void cancellationAndReplacementUseFreshIdsAndNeverChangeTheStoredDefinition() throws Exception {
        var first = create("First", "VIEW_ESTATE");
        var second = create("Second", "VIEW_FAULT_REPORTS");
        var old = invite("manager", first);
        mvc.perform(as("manager", delete(path() + "/council-invitations/" + id(old))))
                .andExpect(status().isNoContent());
        var replacement = invite("manager", second);
        assertNotEquals(id(old), id(replacement));
        accept(old, first).andExpect(status().isNotFound());
        accept(replacement, second).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path() + "/reports"))).andExpect(status().isOk());
        mvc.perform(as("recipient", get(path()))).andExpect(status().isForbidden());
    }

    private boolean hasRecipient() {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("recipient")));
    }

    private void emailDelivery() {
        when(identity.send(any(), anyString(), anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        "provider-" + call.getArgument(0),
                        call.getArgument(1),
                        "pending",
                        OffsetDateTime.now().plusDays(7),
                        null,
                        null));
    }
}
