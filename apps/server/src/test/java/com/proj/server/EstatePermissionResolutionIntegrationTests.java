package com.proj.server;

import static com.proj.server.db.tables.Estaterolepermission.ESTATEROLEPERMISSION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.proj.server.db.tables.Estateroledefinition;
import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.estate.EstatePermissions;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Built-in roles resolve to their seeded bundles; ownership holds every code (spec: estate-role-permissions). */
class EstatePermissionResolutionIntegrationTests extends CustomEstateRoleTestSupport {
    private static Set<String> all() {
        var codes = new HashSet<>(PresetRolePermissionMigrationTests.EXISTING);
        codes.addAll(PresetRolePermissionMigrationTests.ADDED);
        return codes;
    }

    private Set<String> codes(String user) {
        return EstatePermissions.effective(db, estateId, user).stream()
                .map(Enum::name)
                .collect(Collectors.toSet());
    }

    @Test
    void everyCataloguedCodeIsASupportedApplicationCode() {
        assertEquals(
                all(),
                java.util.Arrays.stream(EstatePermissionCode.values())
                        .map(Enum::name)
                        .collect(Collectors.toSet()));
    }

    @Test
    void theOwnerHoldsEveryCode() {
        assertEquals(all(), codes("owner"));
    }

    @Test
    void anOwnerWhoseRowIsNotManagerStillHoldsEveryCode() {
        db.update(ESTATEUSER)
                .set(ESTATEUSER.ROLE, "CREW")
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("owner")))
                .execute();
        assertEquals(all(), codes("owner"));
    }

    @Test
    void anOwnerWithAResidentRowInTheSameEstateHoldsNothing() {
        db.update(ESTATEUSER)
                .set(ESTATEUSER.ROLE, "RESIDENT")
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq("owner")))
                .execute();
        assertEquals(Set.of(), codes("owner"));
    }

    @Test
    void aManagerHoldsEveryCode() {
        assertEquals(all(), codes("manager"));
    }

    @Test
    void councilHoldsTheCouncilBundle() {
        assertEquals(PresetRolePermissionMigrationTests.COUNCIL, codes("member"));
    }

    @Test
    void crewHoldTheCrewBundle() {
        member(estateId, "crew", "CREW");
        assertEquals(PresetRolePermissionMigrationTests.CREW, codes("crew"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"RESIDENT", "NONE"})
    void residentsAndNonMembersHoldNothing(String role) {
        if (!role.equals("NONE")) member(estateId, "someone", role);
        assertEquals(Set.of(), codes("someone"));
    }

    @Test
    void aCustomMemberHoldsExactlyTheirRolesGrantsIncludingNewCodes() {
        customMember("custom", "VIEW_ASSETS", "EDIT_ASSETS", "VIEW_FAULT_REPORTS");
        assertEquals(Set.of("VIEW_ASSETS", "EDIT_ASSETS", "VIEW_FAULT_REPORTS"), codes("custom"));
    }

    @Test
    void aCustomRoleMissingAPrerequisiteHoldsNothing() {
        customMember("custom", "EDIT_ASSETS");
        assertEquals(Set.of(), codes("custom"));
    }

    @Test
    void ownershipGivesNothingInAnotherEstate() {
        var other = estate("someone-else");
        assertEquals(Set.of(), EstatePermissions.effective(db, other, "owner"));
    }

    private void customMember(String user, String... permissions) {
        var definition = Estateroledefinition.ESTATEROLEDEFINITION;
        var role = UUID.randomUUID();
        db.insertInto(definition)
                .set(definition.ID, role)
                .set(definition.ESTATEID, estateId)
                .set(definition.NAME, "Helper")
                .set(definition.NORMALIZEDNAME, "helper")
                .set(definition.CREATEDBYUSERID, "owner")
                .set(definition.UPDATEDAT, OffsetDateTime.now())
                .execute();
        for (var permission : permissions) {
            db.insertInto(ESTATEROLEPERMISSION)
                    .set(ESTATEROLEPERMISSION.ROLEID, role)
                    .set(ESTATEROLEPERMISSION.PERMISSION, permission)
                    .execute();
        }
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estateId)
                .set(ESTATEUSER.USERID, user)
                .set(ESTATEUSER.ROLE, "CUSTOM")
                .set(ESTATEUSER.CUSTOMROLEID, role)
                .execute();
    }
}
