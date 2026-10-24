package com.proj.server;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Location.LOCATION;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Each grant must work at its real HTTP boundary, and be revoked using the same identity. */
class CustomEstateRoleEnforcementIntegrationTests extends CustomEstateRoleTestSupport {
    @Test
    void viewEstateIncludesOnlyPermittedManagementEstatesAndDoesNotExposeAssetsOrMembers() throws Exception {
        grant("member", "VIEW_ESTATE");
        var other = estate("other");
        mvc.perform(as("member", get("/estates")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains(estateId.toString())));
        mvc.perform(as("member", get(path())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(false));
        mvc.perform(as("member", get("/estates/" + other))).andExpect(status().isNotFound());
        mvc.perform(as("member", get(path() + "/members"))).andExpect(status().isForbidden());
        mvc.perform(as("member", get(path() + "/assets"))).andExpect(status().isForbidden());
        mvc.perform(as("member", get("/dashboard/summary")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessibleEstateCount").value(1))
                .andExpect(jsonPath("$.totalActiveAssets").value(0));
        mvc.perform(as("member", get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].role").value("CUSTOM"))
                .andExpect(jsonPath("$.estates[0].canViewManagement").value(true))
                .andExpect(jsonPath("$.estates[0].canManageEstate").value(false))
                .andExpect(jsonPath("$.estates[0].canViewAssets").value(false))
                .andExpect(jsonPath("$.estates[0].canReassignRoles").value(false));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void detailEditingWorksWhileActiveOrInactiveWithoutGrantingLocationOrOwnershipPowers(boolean inactive)
            throws Exception {
        grant("member", "VIEW_ESTATE", "EDIT_ESTATE");
        if (inactive) inactive();
        var before = db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId)).fetchSingle();
        send(
                        "member",
                        patch(path()),
                        Map.of(
                                "name",
                                "Updated",
                                "code",
                                before.getCode(),
                                "address",
                                "New Road",
                                "postalCode",
                                "654321"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated"));
        var after = db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId)).fetchSingle();
        assertEquals(before.get(ESTATE.OWNERUSERID), after.get(ESTATE.OWNERUSERID));
        assertEquals(before.get(ESTATE.DEACTIVATEDAT), after.get(ESTATE.DEACTIVATEDAT));
        send("member", post(path() + "/locations"), Map.of("type", "BLOCK", "name", "Forbidden"))
                .andExpect(status().isForbidden());
        send("member", post(path() + "/ownership-transfer"), Map.of("newOwnerUserId", "manager"))
                .andExpect(status().isForbidden());
    }

    @Test
    void reportOnlyMembersReadListsDetailsImagesAndHistoricalLocationsWithoutManagementAccess() throws Exception {
        grant("member", "VIEW_FAULT_REPORTS");
        var block = location(estateId, "BLOCK", null, "Block A", null);
        var level = location(estateId, "LEVEL", block, "Level 1", 1);
        var report = report(estateId, level, "resident");
        var image = image(report);
        when(imageStore.read("private/" + image)).thenReturn(new byte[] {1, 2, 3});
        mvc.perform(as("member", get(path() + "/reports")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(report.toString()));
        mvc.perform(as("member", get(path() + "/reports/" + report)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images[0].id").value(image.toString()))
                .andExpect(jsonPath("$.images[0].storageKey").doesNotExist());
        mvc.perform(as("member", get(path() + "/reports/" + report + "/images/" + image)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(content().bytes(new byte[] {1, 2, 3}));
        db.update(LOCATION)
                .set(LOCATION.DEACTIVATEDAT, OffsetDateTime.now())
                .where(LOCATION.ID.eq(level))
                .execute();
        mvc.perform(as("member", get(path() + "/locations").param("includeInactive", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(level.toString())));
        mvc.perform(as("member", get("/estates")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(as("member", get(path()))).andExpect(status().isForbidden());
        send(
                        "member",
                        patch(path() + "/reports/" + report + "/location"),
                        Map.of("locationId", level, "expectedLocationId", level))
                .andExpect(status().isForbidden());
        mvc.perform(as("member", get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEnterWorkspace").value(true))
                .andExpect(jsonPath("$.estates[0].canViewManagement").value(false))
                .andExpect(jsonPath("$.estates[0].canViewFaultReports").value(true))
                .andExpect(jsonPath("$.estates[0].canRelocateFaultReports").value(false));
    }

    @Test
    void reportLocationCorrectionsChangeOnlyTheLocationAndUpdatedTimeAndHonorConflicts() throws Exception {
        grant("member", "VIEW_FAULT_REPORTS", "RELOCATE_FAULT_REPORTS");
        var block = location(estateId, "BLOCK", null, "Block A", null);
        var level = location(estateId, "LEVEL", block, "Level 1", 1);
        var target = location(estateId, "COMMON_AREA", level, "Lobby", null);
        var report = report(estateId, level, "resident");
        var before = db.selectFrom(ISSUEREPORT)
                .where(ISSUEREPORT.ID.eq(report))
                .fetchSingle()
                .intoMap();
        send(
                        "member",
                        patch(path() + "/reports/" + report + "/location"),
                        Map.of("locationId", target, "expectedLocationId", level))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(target.toString()));
        var after = db.selectFrom(ISSUEREPORT)
                .where(ISSUEREPORT.ID.eq(report))
                .fetchSingle()
                .intoMap();
        assertEquals(target, after.remove("locationId"));
        before.remove("locationId");
        before.remove("updatedAt");
        after.remove("updatedAt");
        assertEquals(before, after);
        send(
                        "member",
                        patch(path() + "/reports/" + report + "/location"),
                        Map.of("locationId", level, "expectedLocationId", level))
                .andExpect(status().isConflict());
        inactive();
        send(
                        "member",
                        patch(path() + "/reports/" + report + "/location"),
                        Map.of("locationId", level, "expectedLocationId", target))
                .andExpect(status().isConflict());
    }

    @Test
    void reportAndImageIdsCannotBeMixedAcrossEstatesOrReports() throws Exception {
        grant("member", "VIEW_FAULT_REPORTS");
        var block = location(estateId, "BLOCK", null, "Block A", null);
        var level = location(estateId, "LEVEL", block, "Level 1", 1);
        var ownReport = report(estateId, level, "resident");
        var second = report(estateId, level, "resident");
        var secondImage = image(second);
        var foreign = estate("other");
        var foreignBlock = location(foreign, "BLOCK", null, "Block B", null);
        var foreignLevel = location(foreign, "LEVEL", foreignBlock, "Level 1", 1);
        var foreignReport = report(foreign, foreignLevel, "resident");
        mvc.perform(as("member", get(path() + "/reports/" + foreignReport))).andExpect(status().isNotFound());
        mvc.perform(as("member", get(path() + "/reports/" + ownReport + "/images/" + secondImage)))
                .andExpect(status().isNotFound());
        mvc.perform(as("member", get("/estates/" + foreign + "/reports/" + foreignReport)))
                .andExpect(status().isNotFound());
    }

    @Test
    void locationCreatorsCanCreateBlocksLevelsCommonAreasAndBulkFloorsButCannotEditOrDeactivate() throws Exception {
        grant("member", "VIEW_ESTATE", "CREATE_LOCATIONS");
        var block = body(send("member", post(path() + "/locations"), Map.of("type", "BLOCK", "name", "Block A"))
                .andExpect(status().isCreated()));
        var level = body(send(
                        "member",
                        post(path() + "/locations"),
                        Map.of("type", "LEVEL", "name", "Level 1", "parentId", id(block), "sortOrder", 1))
                .andExpect(status().isCreated()));
        send(
                        "member",
                        post(path() + "/locations"),
                        Map.of("type", "COMMON_AREA", "name", "Lobby", "parentId", id(level)))
                .andExpect(status().isCreated());
        send(
                        "member",
                        post(path() + "/locations/" + id(block) + "/floors"),
                        Map.of("lowestFloor", 2, "highestFloor", 3))
                .andExpect(status().isOk());
        send("member", patch(path() + "/locations/" + id(block)), Map.of("name", "Renamed"))
                .andExpect(status().isForbidden());
        mvc.perform(as("member", post(path() + "/locations/" + id(block) + "/deactivate")))
                .andExpect(status().isForbidden());
        mvc.perform(as("member", get("/access/context")))
                .andExpect(jsonPath("$.estates[0].canCreateLocations").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateFloors").value(true))
                .andExpect(jsonPath("$.estates[0].canEditLocations").value(false));
    }

    @Test
    void locationEditorsCanRenameReorderAndMoveButCannotCreateOrDeactivate() throws Exception {
        grant("member", "VIEW_ESTATE", "EDIT_LOCATIONS");
        var first = location(estateId, "BLOCK", null, "Block A", null);
        var second = location(estateId, "BLOCK", null, "Block B", null);
        var level = location(estateId, "LEVEL", first, "Level 1", 1);
        send(
                        "member",
                        patch(path() + "/locations/" + level),
                        Map.of("name", "Level 2", "parentId", second, "sortOrder", 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentId").value(second.toString()))
                .andExpect(jsonPath("$.name").value("Level 2"))
                .andExpect(jsonPath("$.sortOrder").value(2));
        send("member", post(path() + "/locations"), Map.of("type", "BLOCK", "name", "Forbidden"))
                .andExpect(status().isForbidden());
        send("member", post(path() + "/locations/" + first + "/floors"), Map.of("lowestFloor", 2, "highestFloor", 3))
                .andExpect(status().isForbidden());
        mvc.perform(as("member", post(path() + "/locations/" + level + "/deactivate")))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREATE_LOCATIONS", "EDIT_LOCATIONS"})
    void locationGrantsCannotBypassEstateParentOrLifecycleValidation(String permission) throws Exception {
        grant("member", "VIEW_ESTATE", permission);
        var block = location(estateId, "BLOCK", null, "Block A", null);
        var level = location(estateId, "LEVEL", block, "Level 1", 1);
        var other = estate("other");
        var foreign = location(other, "BLOCK", null, "Foreign", null);
        if (permission.equals("CREATE_LOCATIONS")) {
            send(
                            "member",
                            post(path() + "/locations"),
                            Map.of("type", "LEVEL", "name", "Invalid", "parentId", foreign, "sortOrder", 2))
                    .andExpect(status().isNotFound());
            inactive();
            send("member", post(path() + "/locations"), Map.of("type", "BLOCK", "name", "Inactive"))
                    .andExpect(status().isConflict());
        } else {
            send(
                            "member",
                            patch(path() + "/locations/" + level),
                            Map.of("name", "Invalid", "parentId", foreign, "sortOrder", 2))
                    .andExpect(status().isNotFound());
            inactive();
            send(
                            "member",
                            patch(path() + "/locations/" + level),
                            Map.of("name", "Inactive", "parentId", block, "sortOrder", 1))
                    .andExpect(status().isConflict());
        }
        assertEquals(
                block,
                db.select(LOCATION.PARENTID)
                        .from(LOCATION)
                        .where(LOCATION.ID.eq(level))
                        .fetchSingle(LOCATION.PARENTID));
    }

    @Test
    void reassignmentReplacesPermissionsAndRoleEditingRevokesThemOnTheNextRequest() throws Exception {
        var original = grant("member", "VIEW_ESTATE", "EDIT_ESTATE");
        var replacement = create("Report reader", "VIEW_FAULT_REPORTS");
        assign("owner", "member", replacement)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customRoleId").value(id(replacement).toString()));
        mvc.perform(as("member", get(path()))).andExpect(status().isForbidden());
        mvc.perform(as("member", get(path() + "/reports"))).andExpect(status().isOk());
        send("owner", put(roles() + "/" + id(replacement)), updateBody(replacement, "Estate reader", "VIEW_ESTATE"))
                .andExpect(status().isOk());
        mvc.perform(as("member", get(path()))).andExpect(status().isOk());
        mvc.perform(as("member", get(path() + "/reports"))).andExpect(status().isForbidden());
        send("owner", put(path() + "/members/member/role"), Map.of("role", "COUNCIL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customRoleId").value(nullValue()));
        // The previous definitions remain saved; reassignment never deletes them.
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath(
                        "$[*].id",
                        containsInAnyOrder(
                                id(original).toString(), id(replacement).toString())));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "RESIDENT", "CREW", "CUSTOM"})
    void roleReassignmentSucceedsWhenAnotherMembersIdentityIsUnavailable(String targetRole) throws Exception {
        var customRole = create("Inviter", "INVITE_MEMBERS");
        when(identity.user("manager"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unrelated profile unavailable."));
        var request = "CUSTOM".equals(targetRole) ? selector(customRole) : Map.of("role", targetRole);
        send("owner", put(path() + "/members/member/role"), request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("member"))
                .andExpect(jsonPath("$.name").value("member"))
                .andExpect(jsonPath("$.email").value("member@example.com"))
                .andExpect(jsonPath("$.role").value(targetRole))
                .andExpect(jsonPath("$.owner").value(false))
                .andExpect(jsonPath("$.canInviteMembers")
                        .value("MANAGER".equals(targetRole) || "CUSTOM".equals(targetRole)))
                .andExpect(jsonPath("$.customRoleId")
                        .value("CUSTOM".equals(targetRole) ? id(customRole).toString() : null))
                .andExpect(jsonPath("$.customRoleName").value("CUSTOM".equals(targetRole) ? "Inviter" : null));
        assertEquals(
                targetRole,
                db.select(ESTATEUSER.ROLE)
                        .from(ESTATEUSER)
                        .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member")))
                        .fetchSingle(ESTATEUSER.ROLE));
    }

    @Test
    void targetIdentityFailureLeavesTheExistingRoleUnchanged() throws Exception {
        when(identity.user("member"))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Target profile unavailable."));
        send("owner", put(path() + "/members/member/role"), Map.of("role", "MANAGER"))
                .andExpect(status().isBadGateway());
        assertEquals(
                "COUNCIL",
                db.select(ESTATEUSER.ROLE)
                        .from(ESTATEUSER)
                        .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member")))
                        .fetchSingle(ESTATEUSER.ROLE));
    }

    @Test
    void removalRevokesReportAndImageAccessWithoutAnotherSignIn() throws Exception {
        grant("member", "VIEW_FAULT_REPORTS");
        var block = location(estateId, "BLOCK", null, "Block A", null);
        var level = location(estateId, "LEVEL", block, "Level 1", 1);
        var report = report(estateId, level, "resident");
        var image = image(report);
        mvc.perform(as("member", get(path() + "/reports/" + report))).andExpect(status().isOk());
        mvc.perform(as("owner", delete(path() + "/members/member"))).andExpect(status().isNoContent());
        mvc.perform(as("member", get(path() + "/reports/" + report))).andExpect(status().isNotFound());
        mvc.perform(as("member", get(path() + "/reports/" + report + "/images/" + image)))
                .andExpect(status().isNotFound());
    }

    @Test
    void staleRolePreviewsNonmembersAndForeignDefinitionsCannotBeAssigned() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Edited", "VIEW_ESTATE"))
                .andExpect(status().isOk());
        assign("owner", "member", role).andExpect(status().isConflict());
        var current = create("Current", "VIEW_ESTATE");
        assign("owner", "unassigned", current).andExpect(status().isNotFound());
        var other = estate("owner");
        member(other, "member", "COUNCIL");
        send("owner", put("/estates/" + other + "/members/member/role"), selector(current))
                .andExpect(status().isNotFound());
        assign("member", "manager", current).andExpect(status().isForbidden());
        assertEquals(
                "COUNCIL",
                db.select(ESTATEUSER.ROLE)
                        .from(ESTATEUSER)
                        .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member")))
                        .fetchSingle(ESTATEUSER.ROLE));
    }

    @Test
    void ownerAndManagerSelfDemotionRemainProtected() throws Exception {
        var role = create("Reader", "VIEW_ESTATE");
        assign("owner", "owner", role).andExpect(status().isConflict());
        assign("manager", "manager", role).andExpect(status().isConflict());
        assign("owner", "manager", role).andExpect(status().isOk());
        send("owner", post(path() + "/ownership-transfer"), Map.of("newOwnerUserId", "manager"))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "RESIDENT", "CREW", "CUSTOM", "SAME_CUSTOM"})
    void inactiveEstatesRejectEveryPresetOrCustomReassignmentIncludingNoOps(String target) throws Exception {
        var role = grant("member", "VIEW_ESTATE");
        inactive();
        if (target.equals("CUSTOM") || target.equals("SAME_CUSTOM")) {
            assign("owner", "member", role).andExpect(status().isConflict());
        } else {
            send("owner", put(path() + "/members/member/role"), Map.of("role", target))
                    .andExpect(status().isConflict());
        }
        mvc.perform(as("owner", get(path() + "/members")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == 'member')].customRoleId", contains(id(role).toString())));
    }

    @Test
    void residentConversionPreservesOwnHistoryAndOtherEstateMemberships() throws Exception {
        db.update(ESTATEUSER)
                .set(ESTATEUSER.ROLE, "RESIDENT")
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member")))
                .execute();
        var other = estate("other");
        member(other, "member", "RESIDENT");
        var block = location(estateId, "BLOCK", null, "Block A", null);
        var level = location(estateId, "LEVEL", block, "Level 1", 1);
        var report = report(estateId, level, "member");
        var role = create("Estate reader", "VIEW_ESTATE");
        assign("owner", "member", role).andExpect(status().isOk());
        mvc.perform(as("member", get("/resident/reports/" + report))).andExpect(status().isOk());
        mvc.perform(as("member", get("/resident/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[*].id", contains(other.toString())));
        assertEquals(1, db.fetchCount(ISSUEREPORT, ISSUEREPORT.ID.eq(report)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREATE_ROLES", "EDIT_ROLES", "INVITE_MEMBERS"})
    void authoringOrInvitationOnlyMembersEnterTheirScopedWorkspaceWithoutManagementAccess(String permission)
            throws Exception {
        var role = grant("member", permission);
        mvc.perform(as("member", get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEnterWorkspace").value(true))
                .andExpect(jsonPath("$.estates[0].customRoleId").value(id(role).toString()))
                .andExpect(jsonPath("$.estates[0].canViewManagement").value(false))
                .andExpect(jsonPath("$.estates[0].canViewEstateRoles").value(!permission.equals("INVITE_MEMBERS")))
                .andExpect(jsonPath("$.estates[0].canViewEstateInvitations").value(permission.equals("INVITE_MEMBERS")))
                .andExpect(jsonPath("$.estates[0].canDeleteRoles").value(false));
        mvc.perform(as("member", get(path()))).andExpect(status().isForbidden());
        mvc.perform(as("member", get(path() + "/members"))).andExpect(status().isForbidden());
    }
}
