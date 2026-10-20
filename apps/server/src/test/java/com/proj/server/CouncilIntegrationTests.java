package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.estate.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest(properties = {"spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CouncilIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    EstateRepository estates;

    @Autowired
    EstateUserRepository members;

    @Autowired
    DSLContext db;

    @MockitoBean
    com.proj.server.workos.WorkOSService identity;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId;
    final OffsetDateTime expires = OffsetDateTime.now().plusDays(7);

    @BeforeEach
    void setup() {
        db.execute("delete from \"EstateInvitation\"");
        db.execute("delete from \"EstateUser\"");
        db.execute("delete from \"Location\"");
        db.execute("delete from \"Estate\"");
        estateId = estates.create(
                        "owner", new EstateRequest("Estate", UUID.randomUUID().toString(), "Road", "123456", null))
                .id();
        members.add(estateId, "delegate");
        when(identity.user("owner"))
                .thenReturn(new CouncilIdentity.Person("owner", "Owner", "owner@example.com", true));
        when(identity.user("recipient"))
                .thenReturn(new CouncilIdentity.Person("recipient", "Council Member", "member@example.com", true));
        when(identity.user("delegate"))
                .thenReturn(new CouncilIdentity.Person("delegate", "Delegate", "delegate@example.com", true));
        when(identity.send(any(), eq("member@example.com"), anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        "inv_" + call.getArgument(0), "member@example.com", "pending", expires, null, null));
    }

    String path() {
        return "/estates/" + estateId;
    }

    void invite(String user) throws Exception {
        invite(user, "PENDING");
    }

    void invite(String user, String expectedStatus) throws Exception {
        mvc.perform(
                        post(path() + "/council-invitations")
                                .with(jwt().jwt(t -> t.subject(user)))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\" Council Member \",\"email\":\" MEMBER@example.com \",\"role\":\"COUNCIL\",\"canInviteMembers\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("member@example.com"))
                .andExpect(jsonPath("$.status").value(expectedStatus))
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    void permission(String caller, boolean allowed, int status) throws Exception {
        mvc.perform(put(path() + "/members/delegate/invitation-permission")
                        .with(jwt().jwt(t -> t.subject(caller)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"canInviteMembers\":" + allowed + "}"))
                .andExpect(status().is(status));
    }

    void manager(String user) {
        db.execute("update \"EstateUser\" set role='MANAGER' where \"estateId\"=? and \"userId\"=?", estateId, user);
    }

    void role(String user, String role) throws Exception {
        mvc.perform(put(path() + "/members/" + user + "/role")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"" + role + "\"}"))
                .andExpect(status().isOk());
    }

    UUID inviteExisting() throws Exception {
        when(identity.send(any(), anyString(), anyString()))
                .thenReturn(new CouncilIdentity.Invitation(
                        null, "member@example.com", "existing_account", expires, null, null));
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Member\",\"email\":\"member@example.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("IN_APP"));
        return db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
    }

    @Test
    void acceptedRecipientCanReadLocationsUntilTheirMembershipIsRemoved() throws Exception {
        mvc.perform(post(path() + "/locations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"BLOCK\",\"name\":\"Block A\"}"))
                .andExpect(status().isCreated());
        UUID id = inviteExisting();
        mvc.perform(get(path() + "/locations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isNotFound());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        mvc.perform(get(path() + "/locations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Block A"));
        mvc.perform(delete(path() + "/members/recipient").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        mvc.perform(get(path() + "/locations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void staleProviderAcceptanceCannotActivateAReplacementInvitation() throws Exception {
        invite("owner");
        UUID oldId = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
        when(identity.invitation(anyString())).thenAnswer(call -> {
            mvc.perform(delete(path() + "/council-invitations/" + oldId).with(jwt().jwt(t -> t.subject("owner"))))
                    .andExpect(status().isNoContent());
            assertNotEquals(oldId, inviteExisting());
            return new CouncilIdentity.Invitation(
                    call.getArgument(0), "member@example.com", "accepted", expires, "recipient", OffsetDateTime.now());
        });
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void olderEmailInvitationAppearsAndCanBeExplicitlyAcceptedByVerifiedRecipient() throws Exception {
        invite("owner");
        UUID id = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id.toString()));
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isNotFound());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        assertTrue(estates.findAccessible(estateId, "recipient").isPresent());
        verify(identity, never()).invitation(anyString());
    }

    @Test
    void explicitAcceptanceOfOldEmailInvitationStillEnforcesExpiry() throws Exception {
        invite("owner");
        UUID id = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
        db.execute("update \"EstateInvitation\" set \"expiresAt\" = now() - interval '1 minute' where id = ?", id);
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void cancellingAllowsFreshInvitationWithoutRevivingTheCancelledId() throws Exception {
        UUID oldId = inviteExisting();
        mvc.perform(delete(path() + "/council-invitations/" + oldId).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        UUID freshId = inviteExisting();
        assertNotEquals(oldId, freshId);
        mvc.perform(post("/council-invitations/" + oldId + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isNotFound());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        mvc.perform(post("/council-invitations/" + freshId + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
    }

    @Test
    void removedMemberCanBeInvitedAgainWithoutReusingTheAcceptedInvitation() throws Exception {
        UUID oldId = inviteExisting();
        mvc.perform(post("/council-invitations/" + oldId + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        mvc.perform(delete(path() + "/members/recipient").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        UUID freshId = inviteExisting();
        assertNotEquals(oldId, freshId);
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        mvc.perform(post("/council-invitations/" + freshId + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
    }

    @Test
    void ownerCancelsInAppInvitationAndRecipientCannotActivateIt() throws Exception {
        UUID id = inviteExisting();
        mvc.perform(get(path() + "/council-invitations").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("member@example.com"));
        mvc.perform(delete(path() + "/council-invitations/" + id).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        mvc.perform(delete(path() + "/council-invitations/" + id).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void cancelledEmailInvitationCannotActivateEvenAfterProviderAcceptance() throws Exception {
        invite("owner");
        UUID id = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
        mvc.perform(delete(path() + "/council-invitations/" + id).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "member@example.com",
                        "accepted",
                        expires,
                        "recipient",
                        OffsetDateTime.now()));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void cancellationAndRemovalRequireManagersAndAreScopedToOneEstate() throws Exception {
        UUID id = inviteExisting();
        db.execute(
                "update \"EstateUser\" set \"canInviteMembers\"=true where \"estateId\"=? and \"userId\"='delegate'",
                estateId);
        mvc.perform(get(path() + "/council-invitations").with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete(path() + "/council-invitations/" + id).with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete(path() + "/members/delegate").with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete(path() + "/members/delegate")).andExpect(status().isUnauthorized());
        mvc.perform(delete(path() + "/members/owner").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isConflict());
        mvc.perform(delete(path() + "/members/missing").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNotFound());
        var other = estates.create(
                "owner", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        mvc.perform(delete("/estates/" + other.id() + "/council-invitations/" + id)
                        .with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNotFound());
        mvc.perform(delete(path() + "/members/delegate").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void removingMemberRevokesDelegationAndPendingReentryButPreservesOtherEstates() throws Exception {
        UUID id = inviteExisting();
        members.add(estateId, "recipient");
        db.execute(
                "update \"EstateUser\" set \"canInviteMembers\" = true where \"estateId\" = ? and \"userId\" = ?",
                estateId,
                "recipient");
        var other = estates.create(
                "recipient", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        mvc.perform(delete(path() + "/members/recipient").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        mvc.perform(get(path()).with(jwt().jwt(t -> t.subject("recipient")))).andExpect(status().isNotFound());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertTrue(estates.findAccessible(other.id(), "recipient").orElseThrow().owned());
        assertEquals(
                0,
                db.fetchOne(
                                "select count(*) from \"EstateUser\" where \"estateId\" = ? and \"userId\" = ?",
                                estateId,
                                "recipient")
                        .get(0, Integer.class));
    }

    @Test
    void acceptedInvitationRequiresMemberRemovalAndNeverReactivatesAfterRemoval() throws Exception {
        UUID id = inviteExisting();
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        mvc.perform(delete(path() + "/council-invitations/" + id).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isConflict());
        estates.deactivate(estateId, "owner");
        mvc.perform(delete(path() + "/members/recipient").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void concurrentRemovalAndAcceptanceCannotRestoreTheRemovedGrant() throws Exception {
        UUID id = inviteExisting();
        members.add(estateId, "recipient");
        var barrier = new java.util.concurrent.CyclicBarrier(2);
        when(identity.user("recipient")).thenAnswer(call -> {
            barrier.await(10, java.util.concurrent.TimeUnit.SECONDS);
            return new CouncilIdentity.Person("recipient", "Member", "member@example.com", true);
        });
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var removal = executor.submit(
                    () -> mvc.perform(delete(path() + "/members/recipient").with(jwt().jwt(t -> t.subject("owner"))))
                            .andReturn()
                            .getResponse()
                            .getStatus());
            var acceptance = executor.submit(() -> mvc.perform(
                            post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                    .andReturn()
                    .getResponse()
                    .getStatus());
            assertEquals(204, removal.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertTrue(java.util.List.of(200, 409).contains(acceptance.get(15, java.util.concurrent.TimeUnit.SECONDS)));
        }
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void cancellationDuringDispatchCannotBeOverwrittenByProviderResponse() throws Exception {
        when(identity.send(any(), anyString(), anyString())).thenAnswer(call -> {
            mvc.perform(delete(path() + "/council-invitations/" + call.getArgument(0))
                            .with(jwt().jwt(t -> t.subject("owner"))))
                    .andExpect(status().isNoContent());
            return new CouncilIdentity.Invitation("inv_race", "member@example.com", "pending", expires, null, null);
        });
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Member\",\"email\":\"member@example.com\"}"))
                .andExpect(status().isConflict());
        assertEquals(
                "CANCELLED",
                db.fetchOne("select status from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                        .get(0));
    }

    @ParameterizedTest
    @CsvSource({"SENDING, 409", "PENDING, 200", "IN_APP, 200", "ACCEPTED, 409", "CANCELLED, 409", "UNRECOGNIZED, 409"})
    void explicitAcceptanceOnlyGrantsMembershipForAcceptableStates(String state, int expectedStatus) throws Exception {
        UUID id = inviteExisting();
        db.execute("update \"EstateInvitation\" set status = ? where id = ?", state, id);
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().is(expectedStatus));
        assertEquals(
                expectedStatus == 200,
                estates.findAccessible(estateId, "recipient").isPresent());
        assertEquals(
                expectedStatus == 200 ? "ACCEPTED" : state,
                db.fetchOne("select status from \"EstateInvitation\" where id = ?", id)
                        .get(0));
    }

    @Test
    void existingUserSeesInvitationAndExplicitlyAcceptsWithoutLosingAccess() throws Exception {
        var other = estates.create(
                "recipient", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        UUID id = inviteExisting();
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id.toString()))
                .andExpect(jsonPath("$[0].estateName").value("Estate"));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds[0]").value(estateId.toString()));
        assertTrue(estates.findAccessible(other.id(), "recipient").orElseThrow().owned());
        assertFalse(estates.findAccessible(estateId, "recipient").orElseThrow().canInviteMembers());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        verify(identity, never()).invitation(anyString());
    }

    @Test
    void inAppInvitationsRejectWrongUnverifiedUnsignedAndExpiredRecipients() throws Exception {
        UUID id = inviteExisting();
        mvc.perform(get("/council-invitations")).andExpect(status().isUnauthorized());
        mvc.perform(post("/council-invitations/" + id + "/accept")).andExpect(status().isUnauthorized());
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isNotFound());
        when(identity.user("recipient"))
                .thenReturn(new CouncilIdentity.Person("recipient", "Member", "member@example.com", false));
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isForbidden());
        when(identity.user("recipient"))
                .thenReturn(new CouncilIdentity.Person("recipient", "Member", "member@example.com", true));
        db.execute(
                "update \"EstateInvitation\" set \"expiresAt\" = cast(? as timestamptz) where id = ?",
                OffsetDateTime.now().minusMinutes(1),
                id);
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void inAppAcceptanceRejectsExistingMembershipAndInactiveEstate() throws Exception {
        UUID id = inviteExisting();
        members.add(estateId, "recipient");
        db.execute(
                "update \"EstateUser\" set \"canInviteMembers\" = true where \"estateId\" = ? and \"userId\" = ?",
                estateId,
                "recipient");
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        var grant = db.fetchOne(
                "select role, \"canInviteMembers\" from \"EstateUser\" where \"estateId\" = ? and \"userId\" = ?",
                estateId,
                "recipient");
        assertEquals("MEMBER", grant.get(0));
        assertEquals(true, grant.get(1));
        estateId = estates.create(
                        "owner", new EstateRequest("Inactive", UUID.randomUUID().toString(), "Road", "123456", null))
                .id();
        UUID inactive = inviteExisting();
        estates.deactivate(estateId, "owner");
        mvc.perform(post("/council-invitations/" + inactive + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void concurrentInAppAcceptancesGrantOnceAndRemovedDelegateCannotActivate() throws Exception {
        UUID id = inviteExisting();
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            java.util.concurrent.Callable<Integer> accept = () -> mvc.perform(
                            post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                    .andReturn()
                    .getResponse()
                    .getStatus();
            var first = executor.submit(accept);
            var second = executor.submit(accept);
            var statuses = java.util.List.of(
                    first.get(15, java.util.concurrent.TimeUnit.SECONDS),
                    second.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertTrue(statuses.contains(200));
            assertTrue(statuses.contains(409));
        }
        assertEquals(
                1,
                db.fetchOne(
                                "select count(*) from \"EstateUser\" where \"estateId\" = ? and \"userId\" = ?",
                                estateId,
                                "recipient")
                        .get(0, Integer.class));
        estateId = estates.create(
                        "owner", new EstateRequest("Revoked", UUID.randomUUID().toString(), "Road", "123456", null))
                .id();
        UUID revoked = inviteExisting();
        db.execute("update \"EstateInvitation\" set \"inviterUserId\" = ? where id = ?", "delegate", revoked);
        mvc.perform(post("/council-invitations/" + revoked + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void demotingManagerCancelsPreviouslySentInvitations(boolean inApp) throws Exception {
        manager("delegate");
        if (inApp)
            when(identity.send(any(), anyString(), anyString()))
                    .thenReturn(new CouncilIdentity.Invitation(
                            null, "member@example.com", "existing_account", expires, null, null));
        invite("delegate", inApp ? "IN_APP" : "PENDING");
        UUID id = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\"=?", estateId)
                .get(0, UUID.class);
        role("delegate", "COUNCIL");
        assertEquals("CANCELLED", db.fetchValue("select status from \"EstateInvitation\" where id=?", id));
        if (inApp) {
            mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                    .andExpect(status().isConflict());
        } else {
            when(identity.invitation(anyString()))
                    .thenAnswer(call -> new CouncilIdentity.Invitation(
                            call.getArgument(0),
                            "member@example.com",
                            "accepted",
                            expires,
                            "recipient",
                            OffsetDateTime.now()));
            mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.estateIds").isEmpty());
        }
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "IN_APP", "SENDING"})
    void removingInviterCancelsOutstandingInvitations(String state) throws Exception {
        manager("delegate");
        invite("delegate");
        UUID id = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
        db.execute("update \"EstateInvitation\" set status = ? where id = ?", state, id);
        mvc.perform(delete(path() + "/members/delegate").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
        mvc.perform(get(path() + "/council-invitations").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertEquals(
                "CANCELLED",
                db.fetchOne("select status from \"EstateInvitation\" where id = ?", id)
                        .get(0));
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void managersInviteAndDemotionRevokesAuthorityWithinTheirEstate() throws Exception {
        manager("delegate");
        mvc.perform(get(path() + "/members").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].canInviteMembers").value(true));
        permission("delegate", true, 403);
        invite("delegate");
        role("delegate", "COUNCIL");
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("delegate")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Other\",\"email\":\"other@example.com\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get(path() + "/members").with(jwt().jwt(t -> t.subject("stranger"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void readdingALegacyMemberDoesNotRestoreManagerAuthority() throws Exception {
        manager("delegate");
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='delegate'", estateId);
        members.add(estateId, "delegate");
        mvc.perform(get(path()).with(jwt().jwt(t -> t.subject("delegate"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canInviteMembers").value(false));
    }

    @Test
    void acceptanceReusesIdentityAndPreservesOtherAccess() throws Exception {
        var other = estates.create(
                "recipient", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        invite("owner");
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "member@example.com",
                        "accepted",
                        expires,
                        "recipient",
                        OffsetDateTime.now()));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds[0]").value(estateId.toString()));
        assertTrue(estates.findAccessible(estateId, "recipient").isPresent());
        assertTrue(estates.findAccessible(other.id(), "recipient").orElseThrow().owned());
        assertEquals(
                "COUNCIL",
                db.fetchOne(
                                "select role from \"EstateUser\" where \"estateId\" = ? and \"userId\" = ?",
                                estateId,
                                "recipient")
                        .get(0));
        mvc.perform(get(path()).with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canInviteMembers").value(false));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
    }

    @Test
    void wrongIdentityAndExpiredAcceptanceCannotGrantAccess() throws Exception {
        invite("owner");
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "member@example.com",
                        "accepted",
                        expires,
                        "attacker",
                        OffsetDateTime.now()));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "member@example.com",
                        "accepted",
                        expires,
                        "recipient",
                        expires.plusSeconds(1)));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void duplicateInvitationsDoNotSendAgain() throws Exception {
        invite("owner");
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Council Member\",\"email\":\"member@example.com\"}"))
                .andExpect(status().isConflict());
        verify(identity, times(1)).send(any(), anyString(), anyString());
    }

    @Test
    void providerFailureCanRetryWithoutChangingTheDeliveryKey() throws Exception {
        when(identity.send(any(), anyString(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Provider unavailable"));
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Council Member\",\"email\":\"member@example.com\"}"))
                .andExpect(status().isBadGateway());
        var first = db.fetchOne("select id from \"EstateInvitation\" where \"estateId\" = ?", estateId)
                .get(0, UUID.class);
        doReturn(new CouncilIdentity.Invitation("inv_retry", "member@example.com", "pending", expires, null, null))
                .when(identity)
                .send(eq(first), anyString(), anyString());
        invite("owner");
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
    }

    @Test
    void inactiveEstateAndRemovedInviterCannotActivateMembership() throws Exception {
        manager("delegate");
        invite("delegate");
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "member@example.com",
                        "accepted",
                        expires,
                        "recipient",
                        OffsetDateTime.now()));
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='delegate'", estateId);
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        members.add(estateId, "delegate");
        manager("delegate");
        estates.deactivate(estateId, "owner");
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        assertTrue(estates.findAccessible(estateId, "recipient").isEmpty());
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New\",\"email\":\"new@example.com\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void acceptancePreservesAnExistingGrantAndCannotWriteOrReadOtherEstates() throws Exception {
        invite("owner");
        members.add(estateId, "recipient");
        db.execute(
                "update \"EstateUser\" set \"canInviteMembers\" = true where \"estateId\" = ? and \"userId\" = ?",
                estateId,
                "recipient");
        when(identity.invitation(anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        call.getArgument(0),
                        "member@example.com",
                        "accepted",
                        expires,
                        "recipient",
                        OffsetDateTime.now()));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        var grant = db.fetchOne(
                "select role, \"canInviteMembers\" from \"EstateUser\" where \"estateId\" = ? and \"userId\" = ?",
                estateId,
                "recipient");
        assertEquals("MEMBER", grant.get(0));
        assertEquals(true, grant.get(1));
        mvc.perform(
                        patch(path())
                                .with(jwt().jwt(t -> t.subject("recipient")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Changed\",\"code\":\"CH\",\"address\":\"Road\",\"postalCode\":\"123456\"}"))
                .andExpect(status().isForbidden());
        var other = estates.create(
                "stranger", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        mvc.perform(get("/estates/" + other.id()).with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void unsignedAndUnverifiedRecipientsCannotActivateMembership() throws Exception {
        mvc.perform(post("/council-invitations/accept")).andExpect(status().isUnauthorized());
        invite("owner");
        when(identity.user("recipient"))
                .thenReturn(new CouncilIdentity.Person("recipient", "Member", "member@example.com", false));
        mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateIds").isEmpty());
        verify(identity, never()).invitation(anyString());
    }

    @Test
    void twoConcurrentAcceptancesCreateOnlyOneGrant() throws Exception {
        invite("owner");
        var barrier = new java.util.concurrent.CyclicBarrier(2);
        when(identity.invitation(anyString())).thenAnswer(call -> {
            barrier.await(10, java.util.concurrent.TimeUnit.SECONDS);
            return new CouncilIdentity.Invitation(
                    call.getArgument(0), "member@example.com", "accepted", expires, "recipient", OffsetDateTime.now());
        });
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            java.util.concurrent.Callable<Integer> accept =
                    () -> mvc.perform(post("/council-invitations/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                            .andReturn()
                            .getResponse()
                            .getStatus();
            var first = executor.submit(accept);
            var second = executor.submit(accept);
            assertEquals(200, first.get(15, java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(200, second.get(15, java.util.concurrent.TimeUnit.SECONDS));
        }
        assertEquals(
                1,
                db.fetchOne(
                                "select count(*) from \"EstateUser\" where \"estateId\" = ? and \"userId\" = ?",
                                estateId,
                                "recipient")
                        .get(0, Integer.class));
    }

    @Test
    void anEstateOwnerIsAlreadyAMemberAndMustNotReceiveAnInvitation() throws Exception {
        when(identity.user("owner"))
                .thenReturn(new CouncilIdentity.Person("owner", "Owner", "owner@example.com", true));
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Owner\",\"email\":\"owner@example.com\"}"))
                .andExpect(status().isConflict());
        verify(identity, never()).send(any(), anyString(), anyString());
    }
}
