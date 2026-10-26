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
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@org.springframework.transaction.annotation.Transactional
class RoleInvitationsIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @Autowired
    EstateRepository estates;

    @MockitoBean
    com.proj.server.workos.WorkOSService identity;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId;

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager"})
    void ownersAndAssignedManagersCreateBlocksLevelsAndCommonAreas(String caller) throws Exception {
        UUID block = createLocation(caller, "BLOCK", null, 201);
        UUID level = createLocation(caller, "LEVEL", block, 201);
        createLocation(caller, "COMMON_AREA", block, 201);
        createLocation(caller, "COMMON_AREA", level, 201);
        assertEquals(
                4,
                db.fetchCount(
                        org.jooq.impl.DSL.table("\"Location\""),
                        org.jooq.impl.DSL.field("\"estateId\"").eq(estateId)));
    }

    @ParameterizedTest
    @CsvSource({"COUNCIL,404", "MEMBER,404", "CREW,404", "RESIDENT,403", "UNASSIGNED,404", "OTHER_MANAGER,404"})
    void otherRolesAndManagersOfOtherEstatesCannotCreateLocations(String role, int expected) throws Exception {
        if ("OTHER_MANAGER".equals(role)) {
            estates.create(
                    "outsider", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        } else if (!"UNASSIGNED".equals(role)) {
            member("outsider", role);
        }
        createLocation("outsider", "BLOCK", null, expected);
        assertEquals(
                0,
                db.fetchCount(
                        org.jooq.impl.DSL.table("\"Location\""),
                        org.jooq.impl.DSL.field("\"estateId\"").eq(estateId)));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void demotionOrRemovalRevokesLocationCreation(boolean remove) throws Exception {
        createLocation("manager", "BLOCK", null, 201);
        if (remove) {
            mvc.perform(delete(path() + "/members/manager").with(jwt().jwt(t -> t.subject("owner"))))
                    .andExpect(status().isNoContent());
        } else {
            changeRole("owner", "manager", "COUNCIL", 200);
        }
        createLocation("manager", "BLOCK", null, 404);
        assertEquals(
                1,
                db.fetchCount(
                        org.jooq.impl.DSL.table("\"Location\""),
                        org.jooq.impl.DSL.field("\"estateId\"").eq(estateId)));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void formerOwnerCanCreateLocationsButCannotEditDeactivateOrTransfer(boolean legacyOwner) throws Exception {
        if (legacyOwner) db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='owner'", estateId);
        transfer("owner", "manager", 200);
        UUID block = createLocation("owner", "BLOCK", null, 201);
        mvc.perform(patch(path() + "/locations/" + block)
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Renamed block\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post(path() + "/locations/" + block + "/deactivate").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNotFound());
        transfer("owner", "manager", 403);
        deactivate("owner", 403);
        deactivate("manager", 200);
        createLocation("owner", "BLOCK", null, 409);
        createLocation("manager", "BLOCK", null, 409);
        assertEquals(
                1,
                db.fetchCount(
                        org.jooq.impl.DSL.table("\"Location\""),
                        org.jooq.impl.DSL.field("\"estateId\"").eq(estateId)));
    }

    @Test
    void creatingLocationsInMissingEstatesReturnsNotFound() throws Exception {
        mvc.perform(post("/estates/" + UUID.randomUUID() + "/locations")
                        .with(jwt().jwt(t -> t.subject("manager")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"BLOCK\",\"name\":\"New block\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Estate not found."));
    }

    UUID createLocation(String caller, String type, UUID parent, int expected) throws Exception {
        var result = mvc.perform(post(path() + "/locations")
                        .with(jwt().jwt(t -> t.subject(caller)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"" + type + "\",\"name\":\"" + UUID.randomUUID() + "\",\"parentId\":"
                                + (parent == null ? "null" : "\"" + parent + "\"")
                                + ("LEVEL".equals(type) ? ",\"sortOrder\":1" : "") + "}"))
                .andExpect(status().is(expected))
                .andReturn();
        if (expected != 201) return null;
        return UUID.fromString(new tools.jackson.databind.ObjectMapper()
                .readTree(result.getResponse().getContentAsString())
                .get("id")
                .asString());
    }

    @ParameterizedTest
    @CsvSource({"owner,false", "manager,false", "owner,true", "manager,true"})
    void ownersAndAssignedManagersEditDetailsWithoutChangingOwnershipOrStatus(String caller, boolean inactive)
            throws Exception {
        if (inactive) db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estateId);
        var before = db.fetchOne("select * from \"Estate\" where id=?", estateId);
        edit(caller, 200);
        var after = db.fetchOne("select * from \"Estate\" where id=?", estateId);
        assertEquals("Updated estate", after.get("name"));
        assertEquals(before.get("ownerUserId"), after.get("ownerUserId"));
        assertEquals(before.get("deactivatedAt"), after.get("deactivatedAt"));
    }

    @ParameterizedTest
    @CsvSource({"COUNCIL,403", "MEMBER,403", "RESIDENT,403", "CREW,403", "UNASSIGNED,404", "OTHER_MANAGER,404"})
    void otherRolesAndManagersOfOtherEstatesCannotEditDetails(String role, int expected) throws Exception {
        if ("OTHER_MANAGER".equals(role)) {
            estates.create(
                    "outsider", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null));
        } else if (!"UNASSIGNED".equals(role)) {
            member("outsider", role);
        }
        var before =
                db.fetchOne("select * from \"Estate\" where id=?", estateId).intoMap();
        edit("outsider", expected);
        assertEquals(
                before,
                db.fetchOne("select * from \"Estate\" where id=?", estateId).intoMap());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void demotionOrRemovalRevokesEditingOnTheNextRequest(boolean remove) throws Exception {
        edit("manager", 200);
        if (remove) {
            mvc.perform(delete(path() + "/members/manager").with(jwt().jwt(t -> t.subject("owner"))))
                    .andExpect(status().isNoContent());
        } else {
            changeRole("owner", "manager", "COUNCIL", 200);
        }
        var before =
                db.fetchOne("select * from \"Estate\" where id=?", estateId).intoMap();
        edit("manager", remove ? 404 : 403);
        assertEquals(
                before,
                db.fetchOne("select * from \"Estate\" where id=?", estateId).intoMap());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void transferPreservesFormerOwnerEditingButOnlyTheNewOwnerCanTransferOrDeactivate(boolean legacyOwner)
            throws Exception {
        if (legacyOwner) db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='owner'", estateId);
        transfer("manager", "owner", 403);
        deactivate("manager", 403);
        transfer("owner", "manager", 200);
        edit("owner", 200);
        edit("manager", 200);
        transfer("owner", "manager", 403);
        deactivate("owner", 403);
        assertEquals("manager", db.fetchValue("select \"ownerUserId\" from \"Estate\" where id=?", estateId));
        assertNull(db.fetchValue("select \"deactivatedAt\" from \"Estate\" where id=?", estateId));
        deactivate("manager", 200);
        edit("owner", 200);
        assertNotNull(db.fetchValue("select \"deactivatedAt\" from \"Estate\" where id=?", estateId));
    }

    void edit(String caller, int expected) throws Exception {
        mvc.perform(
                        patch(path())
                                .with(jwt().jwt(t -> t.subject(caller)))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Updated estate\",\"code\":\"EDIT-" + estateId
                                                + "\",\"address\":\"Updated Road\",\"postalCode\":\"654321\",\"description\":\"Updated details\"}"))
                .andExpect(status().is(expected));
    }

    void deactivate(String caller, int expected) throws Exception {
        mvc.perform(post(path() + "/deactivate")
                        .with(jwt().jwt(t -> t.subject(caller)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + db.fetchValue("select code from \"Estate\" where id=?", estateId)
                                + "\"}"))
                .andExpect(status().is(expected));
    }

    @Test
    void transferringLegacyOwnershipPreservesTheFormerOwnersManagerAccess() throws Exception {
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='owner'", estateId);
        transfer("owner", "manager", 200);
        assertEquals(
                "MANAGER",
                db.fetchValue("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='owner'", estateId));
    }

    @Test
    void generatedContractUsesResidentCollectionsWithoutSingularFields() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.ResidentContextResponse.properties.estates")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.ResidentContextResponse.properties.estate")
                        .doesNotExist())
                .andExpect(jsonPath("$.components.schemas.AppAccessResponse.properties.residentEstates")
                        .exists())
                .andExpect(jsonPath("$.components.schemas.AppAccessResponse.properties.residentEstate")
                        .doesNotExist());
    }

    @BeforeEach
    void setup() {
        estateId = estates.create(
                        "owner", new EstateRequest("Estate", UUID.randomUUID().toString(), "Road", "123456", null))
                .id();
        member("manager", "MANAGER");
        person("owner");
        person("manager");
        person("recipient");
        when(identity.send(any(), anyString(), anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        null,
                        call.getArgument(1),
                        "existing_account",
                        OffsetDateTime.now().plusDays(7),
                        null,
                        null));
    }

    void person(String user) {
        when(identity.user(user)).thenReturn(new CouncilIdentity.Person(user, user, user + "@example.com", true));
    }

    void member(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?) on conflict (\"estateId\", \"userId\") do update set role=excluded.role",
                estateId,
                user,
                role);
        person(user);
    }

    String path() {
        return "/estates/" + estateId;
    }

    UUID invite(String caller, String role) throws Exception {
        var result = mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject(caller)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"recipient@example.com\",\"role\":\"" + role + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value(role))
                .andReturn();
        return UUID.fromString(new tools.jackson.databind.ObjectMapper()
                .readTree(result.getResponse().getContentAsString())
                .get("id")
                .asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "RESIDENT", "CREW"})
    void managerInvitesEachRoleAndAcceptanceActivatesOnlyTheStoredRole(String role) throws Exception {
        UUID id = invite("manager", role);
        assertNull(db.fetchOne(
                "select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='recipient'", estateId));
        mvc.perform(get("/council-invitations").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].role").value(role));
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        assertEquals(
                role,
                db.fetchOne("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='recipient'", estateId)
                        .get("role"));
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"COUNCIL", "RESIDENT", "CREW", "MEMBER"})
    void nonManagersCannotInviteEvenWithLegacyDelegation(String role) throws Exception {
        member("delegate", role);
        if (!role.equals("RESIDENT"))
            db.execute(
                    "update \"EstateUser\" set \"canInviteMembers\"=true where \"estateId\"=? and \"userId\"='delegate'",
                    estateId);
        mvc.perform(post(path() + "/council-invitations")
                        .with(jwt().jwt(t -> t.subject("delegate")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"recipient@example.com\",\"role\":\"MANAGER\"}"))
                .andExpect(status().isForbidden());
        verify(identity, never()).send(any(), anyString(), anyString());
    }

    @Test
    void managersCannotRemoveOrDemoteThemselvesButAnotherManagerCan() throws Exception {
        mvc.perform(delete(path() + "/members/manager").with(jwt().jwt(t -> t.subject("manager"))))
                .andExpect(status().isConflict());
        changeRole("manager", "manager", "COUNCIL", 409);
        changeRole("owner", "manager", "COUNCIL", 200);
        mvc.perform(delete(path() + "/members/manager").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isNoContent());
    }

    void changeRole(String caller, String target, String role, int expected) throws Exception {
        mvc.perform(put(path() + "/members/" + target + "/role")
                        .with(jwt().jwt(t -> t.subject(caller)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"" + role + "\"}"))
                .andExpect(status().is(expected));
    }

    @Test
    void demotingInviterCancelsPendingInvitationsAndStaleTokensLoseAuthority() throws Exception {
        UUID id = invite("manager", "CREW");
        changeRole("owner", "manager", "COUNCIL", 200);
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        mvc.perform(get(path() + "/members").with(jwt().jwt(t -> t.subject("manager"))))
                .andExpect(status().isForbidden());
        assertEquals(
                "CANCELLED",
                db.fetchOne("select status from \"EstateInvitation\" where id=?", id)
                        .get("status"));
    }

    @Test
    void ownershipRequiresAnExistingSameEstateManagerAndCannotBeLost() throws Exception {
        member("recipient", "COUNCIL");
        changeRole("manager", "owner", "COUNCIL", 409);
        transfer("owner", "recipient", 409);
        transfer("manager", "owner", 403);
        transfer("owner", "unassigned", 409);
        changeRole("manager", "recipient", "MANAGER", 200);
        transfer("owner", "recipient", 200);
        transfer("owner", "manager", 403);
        assertEquals(
                "recipient",
                db.fetchOne("select \"ownerUserId\" from \"Estate\" where id=?", estateId)
                        .get("ownerUserId"));
        assertEquals(
                "MANAGER",
                db.fetchOne("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='owner'", estateId)
                        .get("role"));
    }

    void transfer(String caller, String target, int expected) throws Exception {
        mvc.perform(post(path() + "/ownership-transfer")
                        .with(jwt().jwt(t -> t.subject(caller)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newOwnerUserId\":\"" + target + "\"}"))
                .andExpect(status().is(expected));
    }

    @Test
    void invitationsNeverConvertExistingMemberships() throws Exception {
        UUID id = invite("manager", "CREW");
        member("recipient", "RESIDENT");
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isConflict());
        assertEquals(
                "RESIDENT",
                db.fetchOne("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='recipient'", estateId)
                        .get("role"));
    }

    @Test
    void residentsCanAcceptIntoMultipleEstatesWithoutLosingEarlierMemberships() throws Exception {
        UUID other = estates.create(
                        "owner", new EstateRequest("Other", UUID.randomUUID().toString(), "Road", "123456", null))
                .id();
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, 'recipient', 'RESIDENT')",
                other);
        UUID id = invite("manager", "RESIDENT");
        mvc.perform(post("/council-invitations/" + id + "/accept").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        assertEquals(
                2,
                db.fetchCount(
                        org.jooq.impl.DSL.table("\"EstateUser\""),
                        org.jooq.impl.DSL.field("\"userId\"").eq("recipient")));
        mvc.perform(get("/resident/context").with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates.length()").value(2));
        mvc.perform(get("/resident/locations")
                        .param("estateId", other.toString())
                        .with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isOk());
        mvc.perform(get("/resident/locations")
                        .param("estateId", UUID.randomUUID().toString())
                        .with(jwt().jwt(t -> t.subject("recipient"))))
                .andExpect(status().isForbidden());
    }
}
