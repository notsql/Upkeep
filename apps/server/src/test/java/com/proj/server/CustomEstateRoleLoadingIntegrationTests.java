package com.proj.server;

import static com.proj.server.db.tables.Estaterolepermission.ESTATEROLEPERMISSION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Permission.PERMISSION;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.estate.EstateRoleRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CustomEstateRoleLoadingIntegrationTests extends CustomEstateRoleTestSupport {
    @Autowired
    EstateRoleRepository rolesRepository;

    @Test
    void bulkPermissionsRemainScopedToTheRequestedEstateAndRoles() throws Exception {
        var reader = create("Reader", "VIEW_FAULT_REPORTS");
        var editor = create("Editor", "VIEW_ESTATE", "EDIT_ESTATE");
        var unrequested = create("Unrequested", "INVITE_MEMBERS");
        var foreignEstate = estate("owner");
        var foreign = body(send("owner", postRoles(foreignEstate), roleBody("Foreign", "VIEW_ESTATE"))
                .andExpect(status().isCreated()));
        var unknown = UUID.randomUUID();

        var permissions = rolesRepository.permissions(estateId, List.of(id(reader), id(editor), id(foreign), unknown));

        assertEquals(Set.of(id(reader), id(editor)), permissions.keySet());
        assertEquals(Set.of(EstatePermissionCode.VIEW_FAULT_REPORTS), permissions.get(id(reader)));
        assertEquals(
                Set.of(EstatePermissionCode.VIEW_ESTATE, EstatePermissionCode.EDIT_ESTATE),
                permissions.get(id(editor)));
        assertTrue(rolesRepository.permissions(estateId, List.of()).isEmpty());
        assertEquals(
                Set.of(EstatePermissionCode.INVITE_MEMBERS), rolesRepository.permissions(estateId, id(unrequested)));
    }

    @Test
    void bulkPermissionsRejectUnsupportedAndIncompleteSetsWithoutAffectingOtherRoles() throws Exception {
        var valid = create("Valid", "VIEW_FAULT_REPORTS");
        var incomplete = create("Incomplete", "VIEW_ESTATE", "EDIT_ESTATE");
        var unsupported = create("Unsupported", "VIEW_ESTATE");
        db.deleteFrom(ESTATEROLEPERMISSION)
                .where(ESTATEROLEPERMISSION
                        .ROLEID
                        .eq(id(incomplete))
                        .and(ESTATEROLEPERMISSION.PERMISSION.eq("VIEW_ESTATE")))
                .execute();
        db.insertInto(PERMISSION)
                .set(PERMISSION.CODE, "UNSUPPORTED_TEST_CODE")
                .set(PERMISSION.LABEL, "Unsupported")
                .set(PERMISSION.DESCRIPTION, "Not implemented by this application")
                .execute();
        db.insertInto(ESTATEROLEPERMISSION)
                .set(ESTATEROLEPERMISSION.ROLEID, id(unsupported))
                .set(ESTATEROLEPERMISSION.PERMISSION, "UNSUPPORTED_TEST_CODE")
                .execute();

        var permissions = rolesRepository.permissions(estateId, List.of(id(valid), id(incomplete), id(unsupported)));

        assertEquals(Set.of(EstatePermissionCode.VIEW_FAULT_REPORTS), permissions.get(id(valid)));
        assertEquals(Set.of(), permissions.get(id(incomplete)));
        assertEquals(Set.of(), permissions.get(id(unsupported)));
    }

    @Test
    void assignedRoleLookupExcludesUnassignedUnrequestedAndForeignRoles() throws Exception {
        var assigned = grant("member", "VIEW_FAULT_REPORTS");
        var free = create("Free", "VIEW_ESTATE");
        var unrequested = grant("author", "VIEW_ESTATE");
        var foreignEstate = estate("owner");
        var foreign = body(send("owner", postRoles(foreignEstate), roleBody("Foreign", "VIEW_ESTATE"))
                .andExpect(status().isCreated()));

        assertEquals(
                Set.of(id(assigned)),
                rolesRepository.assignedRoles(estateId, List.of(id(assigned), id(free), id(foreign))));
        assertTrue(rolesRepository.assignedRoles(estateId, List.of()).isEmpty());
        assertEquals(Set.of(id(unrequested)), rolesRepository.assignedRoles(estateId, List.of(id(unrequested))));
        mvc.perform(as("owner", get(roles()))).andExpect(status().isOk());
    }

    @Test
    void memberSummariesKeepPresetAndCustomInvitationAuthoritySeparate() throws Exception {
        var inviter = grant("author", "INVITE_MEMBERS");
        var reader = grant("member", "VIEW_FAULT_REPORTS");
        member(estateId, "recipient", "RESIDENT");
        member(estateId, "other", "CREW");

        var members = body(mvc.perform(as("owner", get(path() + "/members"))).andExpect(status().isOk()));
        for (var member : members) {
            var user = member.get("userId").asText();
            assertEquals(
                    Set.of("owner", "manager", "author").contains(user),
                    member.get("canInviteMembers").asBoolean());
            if (user.equals("author") || user.equals("member")) {
                var role = user.equals("author") ? inviter : reader;
                assertEquals(role.get("id").asText(), member.get("customRoleId").asText());
                assertEquals(
                        role.get("name").asText(), member.get("customRoleName").asText());
            } else {
                assertTrue(member.get("customRoleId").isNull());
            }
        }
        assertEquals(6, members.size());

        inactive();
        var inactiveMembers =
                body(mvc.perform(as("owner", get(path() + "/members"))).andExpect(status().isOk()));
        for (var member : inactiveMembers)
            assertEquals(false, member.get("canInviteMembers").asBoolean());
    }

    @Test
    void memberSummariesIncludeALegacyOwnerWithoutMembership() throws Exception {
        db.deleteFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("owner")))
                .execute();
        mvc.perform(as("owner", get(path() + "/members")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value("owner"))
                .andExpect(jsonPath("$[0].role").value("MANAGER"))
                .andExpect(jsonPath("$[0].canInviteMembers").value(true));
    }

    @Test
    void invitationListsKeepLiveRoleMetadataMatchedAcrossEstatesAndPresets() throws Exception {
        var reader = create("Reader", "VIEW_FAULT_REPORTS");
        var inviter = create("Inviter", "INVITE_MEMBERS");
        invite("manager", reader);
        send("manager", post(path() + "/council-invitations"), offer(inviter, "second@example.com"))
                .andExpect(status().isCreated());
        send("manager", post(path() + "/council-invitations"), java.util.Map.of("email", "preset@example.com"))
                .andExpect(status().isCreated());
        var foreignEstate = estate("owner");
        var foreign = body(send("owner", postRoles(foreignEstate), roleBody("Reader", "VIEW_ESTATE"))
                .andExpect(status().isCreated()));
        send(
                        "owner",
                        post("/estates/" + foreignEstate + "/council-invitations"),
                        offer(foreign, "recipient@example.com"))
                .andExpect(status().isCreated());

        var outstanding = body(
                mvc.perform(as("owner", get(path() + "/council-invitations"))).andExpect(status().isOk()));
        assertEquals(3, outstanding.size());
        for (var invitation : outstanding) {
            var email = invitation.get("email").asText();
            if (email.equals("preset@example.com")) {
                assertTrue(invitation.get("customRoleId").isNull());
                assertTrue(invitation.get("customPermissions").isNull());
                continue;
            }
            var role = email.equals("recipient@example.com") ? reader : inviter;
            assertEquals(role.get("id").asText(), invitation.get("customRoleId").asText());
            assertEquals(
                    role.get("name").asText(), invitation.get("customRoleName").asText());
            assertEquals(
                    role.get("permissions").get(0).asText(),
                    invitation.get("customPermissions").get(0).get("code").asText());
        }

        mvc.perform(as("recipient", get("/council-invitations")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$[*].customRoleId",
                        containsInAnyOrder(id(reader).toString(), id(foreign).toString())))
                .andExpect(jsonPath(
                        "$[*].customPermissions[0].code", containsInAnyOrder("VIEW_FAULT_REPORTS", "VIEW_ESTATE")));
    }

    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder postRoles(UUID estate) {
        return org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                "/estates/" + estate + "/roles");
    }
}
