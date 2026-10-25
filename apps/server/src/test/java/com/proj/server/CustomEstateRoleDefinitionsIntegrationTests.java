package com.proj.server;

import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

/** Acceptance tests for definitions, bounded authoring and guarded physical deletion. */
class CustomEstateRoleDefinitionsIntegrationTests extends CustomEstateRoleTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager"})
    void managersCreateAnEstateScopedDefinitionWithoutChangingAnyMembership(String caller) throws Exception {
        var before = db.selectFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId))
                .orderBy(ESTATEUSER.USERID)
                .fetch();
        var role = body(send(
                        caller,
                        post(roles()),
                        Map.of(
                                "name",
                                "  Caretaker  ",
                                "description",
                                "  Reviews faults  ",
                                "permissions",
                                List.of("VIEW_FAULT_REPORTS")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Caretaker"))
                .andExpect(jsonPath("$.description").value("Reviews faults"))
                .andExpect(jsonPath("$.estateId").value(estateId.toString()))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.canEdit").value(true))
                .andExpect(jsonPath("$.canDelete").value(true))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty()));
        mvc.perform(as(caller, get(roles())))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$[0].id").value(id(role).toString()))
                .andExpect(jsonPath("$[0].permissions", contains("VIEW_FAULT_REPORTS")));
        assertEquals(
                before,
                db.selectFrom(ESTATEUSER)
                        .where(ESTATEUSER.ESTATEID.eq(estateId))
                        .orderBy(ESTATEUSER.USERID)
                        .fetch());
    }

    @Test
    void catalogueContainsTheElevenSupportedCodesWithExplicitPrerequisites() throws Exception {
        mvc.perform(as("owner", get(path() + "/role-permissions")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$[*].code", contains(CODES.toArray())))
                .andExpect(jsonPath("$[*].label", everyItem(not(emptyOrNullString()))))
                .andExpect(jsonPath("$[*].description", everyItem(not(emptyOrNullString()))))
                .andExpect(jsonPath("$[?(@.code == 'EDIT_ESTATE')].requires[0]", contains("VIEW_ESTATE")))
                .andExpect(jsonPath("$[?(@.code == 'CREATE_LOCATIONS')].requires[0]", contains("VIEW_ESTATE")))
                .andExpect(jsonPath("$[?(@.code == 'EDIT_LOCATIONS')].requires[0]", contains("VIEW_ESTATE")))
                .andExpect(jsonPath("$[?(@.code == 'EDIT_DOCUMENTS')].requires[0]", contains("VIEW_DOCUMENTS")))
                .andExpect(jsonPath(
                        "$[?(@.code == 'RELOCATE_FAULT_REPORTS')].requires[0]", contains("VIEW_FAULT_REPORTS")));
    }

    static Stream<Arguments> invalidDefinitions() {
        return Stream.of(
                Arguments.of("blank name", Map.of("name", "  ", "permissions", List.of("VIEW_ESTATE"))),
                Arguments.of(
                        "name longer than 40", Map.of("name", "x".repeat(41), "permissions", List.of("VIEW_ESTATE"))),
                Arguments.of(
                        "description longer than 500",
                        Map.of(
                                "name",
                                "Caretaker",
                                "description",
                                "x".repeat(501),
                                "permissions",
                                List.of("VIEW_ESTATE"))),
                Arguments.of("missing name", Map.of("permissions", List.of("VIEW_ESTATE"))),
                Arguments.of("missing permissions", Map.of("name", "Caretaker")),
                Arguments.of("empty permissions", Map.of("name", "Caretaker", "permissions", List.of())),
                Arguments.of(
                        "unknown permission", Map.of("name", "Caretaker", "permissions", List.of("DELETE_ESTATE"))),
                Arguments.of(
                        "duplicate permission",
                        Map.of("name", "Caretaker", "permissions", List.of("VIEW_ESTATE", "VIEW_ESTATE"))),
                Arguments.of(
                        "estate edit prerequisite", Map.of("name", "Caretaker", "permissions", List.of("EDIT_ESTATE"))),
                Arguments.of(
                        "location create prerequisite",
                        Map.of("name", "Caretaker", "permissions", List.of("CREATE_LOCATIONS"))),
                Arguments.of(
                        "location edit prerequisite",
                        Map.of("name", "Caretaker", "permissions", List.of("EDIT_LOCATIONS"))),
                Arguments.of(
                        "relocation prerequisite",
                        Map.of("name", "Caretaker", "permissions", List.of("RELOCATE_FAULT_REPORTS"))));
    }

    @ParameterizedTest(name = "rejects {0} without saving a partial definition")
    @MethodSource("invalidDefinitions")
    void rejectsInvalidDefinitionsAtomically(String reason, Map<String, Object> payload) throws Exception {
        send("owner", post(roles()), payload).andExpect(status().isBadRequest());
        mvc.perform(as("owner", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "Manager",
                " ADMIN ",
                "Manager (Admin)",
                "Council",
                "Council member",
                "Resident",
                "Crew",
                "Member",
                "OWNER"
            })
    void reservesPresetNamesAndOwnershipAliases(String name) throws Exception {
        send("owner", post(roles()), roleBody(name, "VIEW_ESTATE")).andExpect(status().isBadRequest());
    }

    @Test
    void acceptsBoundaryLengthsAndStoresABlankDescriptionAsNull() throws Exception {
        send(
                        "owner",
                        post(roles()),
                        Map.of(
                                "name",
                                "x".repeat(40),
                                "description",
                                "x".repeat(500),
                                "permissions",
                                List.of("VIEW_ESTATE")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").value("x".repeat(500)));
        send(
                        "owner",
                        post(roles()),
                        Map.of("name", "Blank description", "description", "  ", "permissions", List.of("VIEW_ESTATE")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").value(nullValue()));
    }

    @Test
    void namesAreCaseInsensitiveWithinAnEstateAndReusableInAnother() throws Exception {
        create("Caretaker", "VIEW_ESTATE");
        send("owner", post(roles()), roleBody(" caretaker ", "VIEW_ESTATE")).andExpect(status().isConflict());
        var other = estate("owner");
        send("owner", post("/estates/" + other + "/roles"), roleBody("Caretaker", "VIEW_ESTATE"))
                .andExpect(status().isCreated());
        mvc.perform(as("owner", get(roles()))).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void definitionsAreSortedAndNeverIncludeProtectedPresets() throws Exception {
        create("Zulu", "VIEW_ESTATE");
        create("alpha", "VIEW_ESTATE");
        mvc.perform(as("manager", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("alpha", "Zulu")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"COUNCIL", "CREW", "RESIDENT", "MEMBER"})
    void presetMembersCannotReadTheAdministrationCatalogueOrCreateDefinitions(String preset) throws Exception {
        member(estateId, "other", preset);
        mvc.perform(as("other", get(roles()))).andExpect(status().isForbidden());
        mvc.perform(as("other", get(path() + "/role-permissions"))).andExpect(status().isForbidden());
        send("other", post(roles()), roleBody("Forged", "VIEW_ESTATE")).andExpect(status().isForbidden());
    }

    @Test
    void managerAuthorityInAnotherEstateAndProviderClaimsCannotAuthorHere() throws Exception {
        estate("other");
        mvc.perform(as("other", get(roles()))).andExpect(status().isNotFound());
        send("other", post(roles()), roleBody("Forged", "VIEW_ESTATE")).andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedRequestsCannotUseAnyDefinitionRoute() throws Exception {
        mvc.perform(get(roles())).andExpect(status().isUnauthorized());
        mvc.perform(get(path() + "/role-permissions")).andExpect(status().isUnauthorized());
        mvc.perform(post(roles())
                        .contentType("application/json")
                        .content(json.writeValueAsString(roleBody("Caretaker", "VIEW_ESTATE"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(roles() + "/" + UUID.randomUUID())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(roles() + "/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    @Test
    void createOnlyAuthorsCanGrantOnlyTheirOwnPermissionsWithoutRosterAccess() throws Exception {
        grant("author", "CREATE_ROLES", "VIEW_FAULT_REPORTS");
        mvc.perform(as("author", get(path() + "/role-permissions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].code", containsInAnyOrder("CREATE_ROLES", "VIEW_FAULT_REPORTS")));
        var created = body(send("author", post(roles()), roleBody("Reader", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isCreated()));
        send("author", post(roles()), roleBody("Inviter", "INVITE_MEMBERS")).andExpect(status().isForbidden());
        send("author", put(roles() + "/" + id(created)), updateBody(created, "Renamed", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isForbidden());
        mvc.perform(as("author", get(path() + "/members"))).andExpect(status().isForbidden());
    }

    @Test
    void editOnlyAuthorsCanEditEligibleOtherRolesButCannotCreateOrEscalateThem() throws Exception {
        grant("author", "EDIT_ROLES", "VIEW_FAULT_REPORTS");
        var target = create("Reader", "VIEW_FAULT_REPORTS");
        var stronger = create("Inviter", "INVITE_MEMBERS");
        mvc.perform(as("author", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(id(target).toString())))
                .andExpect(jsonPath("$[*].id", not(hasItem(id(stronger).toString()))));
        send("author", post(roles()), roleBody("New", "VIEW_FAULT_REPORTS")).andExpect(status().isForbidden());
        send("author", put(roles() + "/" + id(stronger)), updateBody(stronger, "Reduced", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isForbidden());
        send("author", put(roles() + "/" + id(target)), updateBody(target, "Escalated", "INVITE_MEMBERS"))
                .andExpect(status().isForbidden());
        send("author", put(roles() + "/" + id(target)), updateBody(target, "Renamed reader", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed reader"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"metadata", "reduce", "add", "noop"})
    void authorsCannotEditTheirOwnAssignedRoleEvenToRenameReduceOrSubmitANoOp(String change) throws Exception {
        var own = grant("author", "EDIT_ROLES", "VIEW_FAULT_REPORTS");
        var payload = updateBody(
                own,
                change.equals("metadata") ? "Renamed" : own.get("name").asText(),
                change.equals("reduce")
                        ? new String[] {"EDIT_ROLES"}
                        : change.equals("add")
                                ? new String[] {"EDIT_ROLES", "VIEW_FAULT_REPORTS", "INVITE_MEMBERS"}
                                : new String[] {"EDIT_ROLES", "VIEW_FAULT_REPORTS"});
        send("author", put(roles() + "/" + id(own)), payload).andExpect(status().isForbidden());
        mvc.perform(as("author", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + id(own) + "')].canEdit", contains(false)));
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[0].version").value(1))
                .andExpect(jsonPath("$[0].name").value(own.get("name").asText()));
    }

    @Test
    void editingUsesExpectedVersionAndANoOpPreservesVersionAndTimestamp() throws Exception {
        var role = create("Reader", "VIEW_FAULT_REPORTS");
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Reader", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.updatedAt").value(role.get("updatedAt").asText()));
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Updated reader", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2));
        send("manager", put(roles() + "/" + id(role)), updateBody(role, "Stale overwrite", "INVITE_MEMBERS"))
                .andExpect(status().isConflict());
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[0].name").value("Updated reader"))
                .andExpect(jsonPath("$[0].permissions", contains("VIEW_FAULT_REPORTS")));
    }

    @ParameterizedTest(name = "updates reject {0} without replacing the saved definition")
    @MethodSource("invalidDefinitions")
    void editingRetainsCreationValidation(String reason, Map<String, Object> invalid) throws Exception {
        var role = create("Reader", "VIEW_FAULT_REPORTS");
        var payload = new HashMap<>(invalid);
        payload.put("expectedVersion", 1);
        send("owner", put(roles() + "/" + id(role)), payload).andExpect(status().isBadRequest());
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[0].name").value("Reader"))
                .andExpect(jsonPath("$[0].version").value(1));
    }

    @Test
    void inactiveEstatesAllowDefinitionReadsButRejectAllDefinitionWrites() throws Exception {
        var role = create("Reader", "VIEW_FAULT_REPORTS");
        inactive();
        mvc.perform(as("owner", get(roles())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].canEdit").value(false))
                .andExpect(jsonPath("$[0].canDelete").value(false));
        mvc.perform(as("owner", get(path() + "/role-permissions"))).andExpect(status().isOk());
        send("owner", post(roles()), roleBody("Another", "VIEW_ESTATE")).andExpect(status().isConflict());
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Changed", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isConflict());
        mvc.perform(as("owner", delete(roles() + "/" + id(role)))).andExpect(status().isConflict());
        mvc.perform(as("owner", get(roles()))).andExpect(jsonPath("$[0].name").value("Reader"));
    }

    @Test
    void deletionIsBlockedUntilMembersAreExplicitlyReassigned() throws Exception {
        var role = grant("member", "VIEW_FAULT_REPORTS");
        mvc.perform(as("owner", get(roles())))
                .andExpect(jsonPath("$[0].canDelete").value(false));
        mvc.perform(as("owner", delete(roles() + "/" + id(role)))).andExpect(status().isConflict());
        send("owner", put(path() + "/members/member/role"), Map.of("role", "COUNCIL"))
                .andExpect(status().isOk());
        mvc.perform(as("manager", delete(roles() + "/" + id(role)))).andExpect(status().isNoContent());
        mvc.perform(as("owner", get(roles()))).andExpect(jsonPath("$").isEmpty());
        assertEquals(
                "COUNCIL",
                db.select(ESTATEUSER.ROLE)
                        .from(ESTATEUSER)
                        .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("member")))
                        .fetchSingle(ESTATEUSER.ROLE));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREATE_ROLES", "EDIT_ROLES"})
    void delegatedAuthorsNeverGainDeletionAuthority(String permission) throws Exception {
        grant("author", permission, "VIEW_FAULT_REPORTS");
        var target = create("Reader", "VIEW_FAULT_REPORTS");
        mvc.perform(as("author", get(roles()))).andExpect(jsonPath("$[*].canDelete", everyItem(is(false))));
        mvc.perform(as("author", delete(roles() + "/" + id(target)))).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "RESIDENT", "CREW"})
    void evenTheOwnerCannotDeleteAPresetByPassingItsCodeAsAnId(String preset) throws Exception {
        mvc.perform(as("owner", delete(roles() + "/" + preset))).andExpect(status().isBadRequest());
        assertEquals(3, db.fetchCount(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId)));
    }

    @Test
    void missingForeignAndDeletedIdsDoNotBecomeEditableOrAssignable() throws Exception {
        var role = create("Reader", "VIEW_FAULT_REPORTS");
        var foreignEstate = estate("owner");
        send(
                        "owner",
                        put("/estates/" + foreignEstate + "/roles/" + id(role)),
                        updateBody(role, "Stolen", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isNotFound());
        mvc.perform(as("owner", delete("/estates/" + foreignEstate + "/roles/" + id(role))))
                .andExpect(status().isNotFound());
        mvc.perform(as("owner", delete(roles() + "/" + UUID.randomUUID()))).andExpect(status().isNotFound());
        mvc.perform(as("owner", delete(roles() + "/" + id(role)))).andExpect(status().isNoContent());
        send("owner", put(roles() + "/" + id(role)), updateBody(role, "Resurrected", "VIEW_FAULT_REPORTS"))
                .andExpect(status().isNotFound());
        assign("owner", "member", role).andExpect(status().isNotFound());
    }
}
