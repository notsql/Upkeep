package com.proj.server.estate;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.config.SecurityConfig;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = CouncilController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, CouncilService.class, EstateExceptionHandler.class})
class CouncilControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    EstateRepository estates;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @MockitoBean
    CouncilRepository council;

    @MockitoBean
    CouncilIdentity identity;

    private final UUID estateId = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");

    @Test
    void accessStorageFailureDeniesMemberAdministrationWithAControlledError() throws Exception {
        when(estates.findAccessible(estateId, "manager"))
                .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("database unavailable"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                                "/estates/" + estateId + "/members")
                        .with(jwt().jwt(token -> token.subject("manager"))))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void verifiedRecipientCanExplicitlyAcceptAnOlderEmailInvitation() throws Exception {
        var id = UUID.randomUUID();
        var row = new com.proj.server.db.tables.records.EstateinvitationRecord();
        row.setId(id);
        row.setEstateid(estateId);
        row.setStatus("PENDING");
        row.setProviderinvitationid("inv_old");
        when(identity.user("member"))
                .thenReturn(new CouncilIdentity.Person("member", "Member", "member@example.com", true));
        when(council.forRecipient(id, "member@example.com")).thenReturn(Optional.of(row));
        when(council.activateExplicit(
                        org.mockito.ArgumentMatchers.eq(id),
                        org.mockito.ArgumentMatchers.eq("member"),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("member"))))
                .andExpect(status().isOk());
    }

    @Test
    void existingAccountInvitationIsPendingInAppWithoutGrantingAccess() throws Exception {
        var now = OffsetDateTime.now();
        when(estates.findAccessible(estateId, "owner"))
                .thenReturn(Optional.of(
                        new EstateResponse(estateId, "Estate", "E", "Road", "123456", null, now, now, null, true)));
        when(council.ownerUserId(estateId)).thenReturn("owner");
        when(identity.user("owner"))
                .thenReturn(new CouncilIdentity.Person("owner", "Owner", "owner@example.com", true));
        var row = new com.proj.server.db.tables.records.EstateinvitationRecord();
        row.setId(UUID.randomUUID());
        row.setEstateid(estateId);
        row.setName("Member");
        row.setEmail("member@example.com");
        row.setInviteruserid("owner");
        row.setStatus("SENDING");
        row.setRole("COUNCIL");
        when(council.sent(org.mockito.ArgumentMatchers.eq(row.getId()), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        when(council.reserve(
                        org.mockito.ArgumentMatchers.eq(estateId),
                        org.mockito.ArgumentMatchers.eq("owner"),
                        org.mockito.ArgumentMatchers.any()))
                .thenReturn(row);
        when(identity.send(row.getId(), row.getEmail(), "owner"))
                .thenReturn(new CouncilIdentity.Invitation(
                        null, row.getEmail(), "existing_account", now.plusDays(7), null, null));
        mvc.perform(post("/estates/" + estateId + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"member@example.com\"}"))
                .andExpect(status().isCreated())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.status")
                        .value("IN_APP"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.name")
                        .doesNotExist());
    }

    @Test
    void unverifiedUsersCannotListOrAcceptInAppInvitations() throws Exception {
        when(identity.user("member"))
                .thenReturn(new CouncilIdentity.Person("member", "Member", "member@example.com", false));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/council-invitations")
                        .with(jwt().jwt(t -> t.subject("member"))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/council-invitations/" + UUID.randomUUID() + "/accept")
                        .with(jwt().jwt(t -> t.subject("member"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void aSharedEstateMemberCannotInviteWithoutPermission() throws Exception {
        var now = OffsetDateTime.now();
        when(estates.findAccessible(estateId, "member"))
                .thenReturn(Optional.of(
                        new EstateResponse(estateId, "Estate", "E", "Road", "123456", null, now, now, null, false)));
        mvc.perform(post("/estates/" + estateId + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("member")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Council Member\",\"email\":\"member@example.com\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void evenOwnersCannotRestoreRetiredInvitationDelegation() throws Exception {
        when(council.setPermission(estateId, "member", true)).thenReturn(true);
        var now = OffsetDateTime.now();
        when(estates.findAccessible(estateId, "owner"))
                .thenReturn(Optional.of(
                        new EstateResponse(estateId, "Estate", "E", "Road", "123456", null, now, now, null, true)));
        mvc.perform(put("/estates/" + estateId + "/members/member/invitation-permission")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"canInviteMembers\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aDelegateCannotPassPermissionOn() throws Exception {
        var now = OffsetDateTime.now();
        when(estates.findAccessible(estateId, "delegate"))
                .thenReturn(Optional.of(
                        new EstateResponse(estateId, "Estate", "E", "Road", "123456", null, now, now, null, false)));
        when(council.canInvite(estateId, "delegate")).thenReturn(true);
        mvc.perform(put("/estates/" + estateId + "/members/member/invitation-permission")
                        .with(jwt().jwt(t -> t.subject("delegate")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"canInviteMembers\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidInvitationDoesNotSendAnEmail() throws Exception {
        var now = OffsetDateTime.now();
        when(estates.findAccessible(estateId, "owner"))
                .thenReturn(Optional.of(
                        new EstateResponse(estateId, "Estate", "E", "Road", "123456", null, now, now, null, true)));
        mvc.perform(post("/estates/" + estateId + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\" \",\"email\":\"bad\"}"))
                .andExpect(status().isBadRequest());
    }
}
