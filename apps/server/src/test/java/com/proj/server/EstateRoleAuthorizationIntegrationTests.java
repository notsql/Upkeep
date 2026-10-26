package com.proj.server;

import static com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;
import static com.proj.server.db.tables.Assetevent.ASSETEVENT;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.anomaly.AnomalyScorer;
import com.proj.server.estate.CouncilIdentity;
import com.proj.server.workos.WorkOSService;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** Permissions follow the target estate, not an account-wide WorkOS resident role. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class EstateRoleAuthorizationIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService identity;

    @MockitoBean
    AnomalyScorer ml;

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request, String user, String role) {
        return request.with(jwt().jwt(token -> token.subject(user).claim("role", role))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private UUID estate(String name, String owner) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, ?, ?, ?, 'Confidential address', '123456', now())",
                id,
                owner,
                name,
                id.toString());
        return id;
    }

    private void membership(String user, UUID estate, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    private UUID block(UUID estate) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                id,
                estate);
        return id;
    }

    private UUID asset(UUID estate) {
        var location = block(estate);
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, ?, 'Private pump', 'PUMP', now())",
                id,
                estate,
                location,
                id.toString());
        return id;
    }

    private UUID reportLocation(UUID estate) {
        var parent = block(estate);
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, \"parentId\", \"parentType\", name, \"sortOrder\", \"updatedAt\") values (?, ?, 'LEVEL', ?, 'BLOCK', 'Level 1', 1, now())",
                id,
                estate,
                parent);
        return id;
    }

    private UUID invitation(UUID estate, String owner, String email) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"EstateInvitation\" (id, \"estateId\", name, email, \"inviterUserId\", status, \"expiresAt\") values (?, ?, '', ?, ?, 'IN_APP', now()+interval '1 day')",
                id,
                estate,
                email,
                owner);
        return id;
    }

    static Stream<Arguments> restoredEstateOperations() {
        return Stream.of(
                Arguments.of("GET", "/estates/%s/assets/%s/events", 200),
                Arguments.of("POST", "/estates/%s/assets/%s/events", 201),
                Arguments.of("GET", "/estates/%s/assets/%s/failure-risk", 200),
                Arguments.of("GET", "/estates/%s/failure-risk", 200),
                Arguments.of("POST", "/estates/%s/assets/%s/readings/anomaly-check", 200));
    }

    private MockHttpServletRequestBuilder managementRequest(String method, String template, UUID estate, UUID asset) {
        var builder = request(HttpMethod.valueOf(method), template.formatted(estate, asset));
        if (!method.equals("POST")) {
            return builder;
        }
        if (template.endsWith("/events")) {
            return builder.contentType(MediaType.APPLICATION_JSON)
                    .content("{\"type\":\"PREVENTIVE\",\"occurredOn\":\"2020-01-01\",\"notes\":\"Routine service\"}");
        }
        var readings =
                IntStream.range(0, 10).mapToObj(second -> """
                        {"timestamp":"2020-01-01T00:00:%02dZ","vibrationAcceleration":0.42,"pressure":3.1,"temperature":41.5,"flowRate":12.8,"power":5.6}
                        """.formatted(second)).collect(Collectors.joining(","));
        return builder.contentType(MediaType.APPLICATION_JSON).content("{\"readings\":[" + readings + "]}");
    }

    @ParameterizedTest
    @MethodSource("restoredEstateOperations")
    void restoredOperationsDenyResidentOwnershipConflictsButAllowOwnershipElsewhere(
            String method, String template, int success) throws Exception {
        var a = estate("Conflicting estate", "mixed-user");
        var b = estate("Owned estate", "mixed-user");
        membership("mixed-user", a, "RESIDENT");
        var privateAsset = asset(a);
        var ownAsset = asset(b);
        for (var role : new String[] {"user", "resident", "admin"}) {
            mvc.perform(asUser(managementRequest(method, template, a, privateAsset), "mixed-user", role))
                    .andExpect(status().isForbidden());
        }
        assertEquals(0, db.fetchCount(ASSETEVENT));
        assertEquals(0, db.fetchCount(ASSETASSESSMENT));
        verifyNoInteractions(ml);

        when(ml.scores(any(double[][].class))).thenReturn(new double[10]);
        mvc.perform(asUser(managementRequest(method, template, b, ownAsset), "mixed-user", "resident"))
                .andExpect(status().is(success));
    }

    @ParameterizedTest
    @MethodSource("restoredEstateOperations")
    void restoredOperationsRemainOwnerOnly(String method, String template, int success) throws Exception {
        var a = estate("Private estate", "owner");
        var privateAsset = asset(a);
        membership("member", a, "MEMBER");
        membership("council", a, "COUNCIL");
        for (var user : new String[] {"member", "council", "unrelated"}) {
            mvc.perform(asUser(managementRequest(method, template, a, privateAsset), user, "user"))
                    .andExpect(status().isNotFound());
        }
        mvc.perform(asUser(managementRequest(method, template, a, privateAsset), "platform-admin", "admin"))
                .andExpect(status().isNotFound());
        assertEquals(0, db.fetchCount(ASSETEVENT));
        assertEquals(0, db.fetchCount(ASSETASSESSMENT));
        verifyNoInteractions(ml);
    }

    @ParameterizedTest
    @MethodSource("restoredEstateOperations")
    void restoredOperationsDoNotExposeAnotherEstatesAsset(String method, String template, int success)
            throws Exception {
        var a = estate("Other estate", "other-owner");
        var b = estate("Owned estate", "owner");
        var privateAsset = asset(a);
        if (template.equals("/estates/%s/failure-risk")) {
            mvc.perform(asUser(managementRequest(method, template, b, privateAsset), "owner", "user"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(0));
        } else {
            mvc.perform(asUser(managementRequest(method, template, b, privateAsset), "owner", "user"))
                    .andExpect(status().isNotFound());
        }
        assertEquals(0, db.fetchCount(ASSETEVENT));
        assertEquals(0, db.fetchCount(ASSETASSESSMENT));
        verifyNoInteractions(ml);
    }

    @Test
    void unassignedAccountCanCreateWithoutExistingEstateCapabilities() throws Exception {
        mvc.perform(get("/access/context")).andExpect(status().isUnauthorized());
        for (var role : new String[] {"user", "resident", "admin"}) {
            mvc.perform(asUser(get("/access/context"), "unassigned", role))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "private, no-store"))
                    .andExpect(jsonPath("$.canEnterWorkspace").value(false))
                    .andExpect(jsonPath("$.canCreateEstate").value(true))
                    .andExpect(jsonPath("$.canAccessPlatformAdmin").value(false))
                    .andExpect(jsonPath("$.hasResidentMembership").value(false))
                    .andExpect(jsonPath("$.canSubmitReport").value(false))
                    .andExpect(jsonPath("$.residentEstates").isEmpty())
                    .andExpect(jsonPath("$.estates").isEmpty());
        }
    }

    static Stream<Arguments> estateCreators() {
        return Stream.of("UNASSIGNED", "RESIDENT", "CREW", "COUNCIL", "MEMBER", "MANAGER", "OWNER")
                .flatMap(membership ->
                        Stream.of("user", "resident", "admin").map(claim -> Arguments.of(membership, claim)));
    }

    @ParameterizedTest(name = "{0} can create with WorkOS role {1}")
    @MethodSource("estateCreators")
    void anyAccountCanCreateItsOwnEstateWithoutChangingExistingAssignments(String role, String claim) throws Exception {
        var previous = estate("Existing estate", role.equals("OWNER") ? "creator" : "previous-owner");
        if (!role.equals("UNASSIGNED") && !role.equals("OWNER")) {
            membership("creator", previous, role);
        }
        var pending = invitation(previous, "previous-owner", "pending@example.com");
        var previousEstate = db.fetch("select * from \"Estate\" where id=?", previous);
        var previousMembers = db.fetch("select * from \"EstateUser\" where \"estateId\"=?", previous);
        var previousInvitation = db.fetch("select * from \"EstateInvitation\" where id=?", pending);
        int count = db.fetchCount(ESTATE);

        mvc.perform(asUser(post("/estates"), "creator", claim)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"name":" New Estate ","code":" self-001 ","address":" New Road ",
                             "postalCode":" 123456 ","ownerUserId":"attacker","role":"RESIDENT"}
                            """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("New Estate"))
                .andExpect(jsonPath("$.code").value("SELF-001"))
                .andExpect(jsonPath("$.owned").value(true));

        var created = db.select(ESTATE.ID)
                .from(ESTATE)
                .where(ESTATE.CODE.eq("SELF-001"))
                .fetchSingle(ESTATE.ID);
        assertEquals(count + 1, db.fetchCount(ESTATE));
        assertEquals("creator", db.fetchValue("select \"ownerUserId\" from \"Estate\" where id=?", created));
        assertEquals(
                "MANAGER",
                db.fetchValue(
                        "select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='creator'", created));
        assertEquals(1, db.fetchCount(ESTATEUSER, ESTATEUSER.ESTATEID.eq(created)));
        assertEquals(previousEstate, db.fetch("select * from \"Estate\" where id=?", previous));
        assertEquals(previousMembers, db.fetch("select * from \"EstateUser\" where \"estateId\"=?", previous));
        assertEquals(previousInvitation, db.fetch("select * from \"EstateInvitation\" where id=?", pending));

        mvc.perform(asUser(get("/access/context"), "creator", claim))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEnterWorkspace").value(true))
                .andExpect(jsonPath("$.canCreateEstate").value(true))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + created + "')].canManageEstate")
                        .value(org.hamcrest.Matchers.contains(true)));
        mvc.perform(asUser(get("/estates/" + created), "creator", claim))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(true));

        if (role.equals("RESIDENT")) {
            mvc.perform(asUser(get("/estates/" + previous), "creator", claim)).andExpect(status().isForbidden());
            mvc.perform(asUser(get("/resident/context"), "creator", claim))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.canSubmit").value(true))
                    .andExpect(jsonPath("$.estates[0].id").value(previous.toString()));
        }
        if (role.equals("RESIDENT") || role.equals("CREW") || role.equals("COUNCIL") || role.equals("MEMBER")) {
            mvc.perform(
                            asUser(patch("/estates/" + previous), "creator", claim)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"name\":\"Changed\",\"code\":\"CHANGED\",\"address\":\"Road\",\"postalCode\":\"123456\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(asUser(post("/estates/" + previous + "/council-invitations"), "creator", claim)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"new@example.com\",\"role\":\"MANAGER\"}"))
                    .andExpect(status().isForbidden());
        }
        var unrelated = estate("Unrelated", "unrelated-owner");
        mvc.perform(asUser(get("/estates/" + unrelated), "creator", claim)).andExpect(status().isNotFound());
    }

    @ParameterizedTest(name = "{0} creation eligibility with WorkOS role {1}")
    @MethodSource("estateCreators")
    void creationEligibilityDoesNotDependOnMembershipOrWorkosClaims(String role, String claim) throws Exception {
        if (!role.equals("UNASSIGNED")) {
            var assigned = estate("Assigned estate", role.equals("OWNER") ? "creator" : "someone-else");
            if (!role.equals("OWNER")) {
                membership("creator", assigned, role);
            }
        }
        mvc.perform(asUser(get("/access/context"), "creator", claim))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.canCreateEstate").value(true))
                .andExpect(
                        jsonPath("$.canEnterWorkspace").value(!role.equals("UNASSIGNED") && !role.equals("RESIDENT")))
                .andExpect(jsonPath("$.canAccessPlatformAdmin").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"UNASSIGNED", "RESIDENT", "CREW"})
    void directoryIncludesAssignedCrewButHidesUnassignedAndResidentEstates(String role) throws Exception {
        var assigned = estate("Assigned estate", "other-owner");
        if (!role.equals("UNASSIGNED")) {
            membership("creator", assigned, role);
        }
        mvc.perform(asUser(get("/estates"), "creator", "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(role.equals("CREW") ? 1 : 0));
        if (role.equals("CREW")) {
            mvc.perform(asUser(get("/estates/" + assigned), "creator", "user"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(assigned.toString()));
        }
    }

    @Test
    void firstEstateCreationStillRejectsAnonymousAndBlankSubjects() throws Exception {
        var body = "{\"name\":\"Estate\",\"code\":\"FIRST\",\"address\":\"Road\",\"postalCode\":\"123456\"}";
        int count = db.fetchCount(ESTATE);
        mvc.perform(post("/estates").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(asUser(post("/estates"), " ", "user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
        assertEquals(count, db.fetchCount(ESTATE));
    }

    @Test
    void newlyEligibleAccountReceivesValidationAndDuplicateErrors() throws Exception {
        var existing = estate("Existing", "other-owner");
        db.execute("update \"Estate\" set code='TAKEN', \"deactivatedAt\"=now() where id=?", existing);
        int estatesBefore = db.fetchCount(ESTATE);
        int membersBefore = db.fetchCount(ESTATEUSER);
        mvc.perform(asUser(post("/estates"), "creator", "user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\" \",\"code\":\"NEW\",\"address\":\"Road\",\"postalCode\":\"123456\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(estatesBefore, db.fetchCount(ESTATE));
        assertEquals(membersBefore, db.fetchCount(ESTATEUSER));
        mvc.perform(
                        asUser(post("/estates"), "creator", "user")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Estate\",\"code\":\" taken \",\"address\":\"Road\",\"postalCode\":\"123456\"}"))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"user", "resident", "admin"})
    void oneAccountHasResidentCouncilAndOwnerPermissionsInDifferentEstates(String jwtRole) throws Exception {
        var residentEstate = estate("Resident estate", "other-owner");
        var councilEstate = estate("Council estate", "council-owner");
        var ownedEstate = estate("Owned estate", "mixed-user");
        membership("mixed-user", residentEstate, "RESIDENT");
        membership("mixed-user", councilEstate, "COUNCIL");
        block(residentEstate);
        block(councilEstate);
        var ownedAsset = asset(ownedEstate);

        mvc.perform(asUser(get("/estates/" + residentEstate), "mixed-user", jwtRole))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + residentEstate + "/locations"), "mixed-user", jwtRole))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + residentEstate + "/members"), "mixed-user", jwtRole))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + councilEstate), "mixed-user", jwtRole))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(false));
        mvc.perform(asUser(get("/estates/" + councilEstate + "/locations"), "mixed-user", jwtRole))
                .andExpect(status().isOk());
        mvc.perform(asUser(get("/estates/" + councilEstate + "/assets"), "mixed-user", jwtRole))
                .andExpect(status().isNotFound()); // The existing asset API remains owner-only.
        mvc.perform(asUser(get("/estates/" + ownedEstate + "/assets/" + ownedAsset), "mixed-user", jwtRole))
                .andExpect(status().isOk());
        mvc.perform(asUser(get("/estates/" + UUID.randomUUID()), "mixed-user", jwtRole))
                .andExpect(status().isNotFound());
    }

    @Test
    void accessProjectionContainsIndependentEstateCapabilitiesAndNoConfidentialFields() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Council estate", "owner-b");
        var c = estate("Owned estate", "mixed-user");
        membership("mixed-user", a, "RESIDENT");
        membership("mixed-user", b, "COUNCIL");
        mvc.perform(asUser(get("/access/context"), "mixed-user", "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEnterWorkspace").value(true))
                .andExpect(jsonPath("$.canCreateEstate").value(true))
                .andExpect(jsonPath("$.canSubmitReport").value(true))
                .andExpect(jsonPath("$.residentEstates[0].id").value(a.toString()))
                .andExpect(jsonPath("$.residentEstates[0].address").doesNotExist())
                .andExpect(jsonPath("$.estates.length()").value(3))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + a + "')].role")
                        .value(org.hamcrest.Matchers.contains("RESIDENT")))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + a + "')].canViewManagement")
                        .value(org.hamcrest.Matchers.contains(false)))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + b + "')].canViewManagement")
                        .value(org.hamcrest.Matchers.contains(true)))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + b + "')].canViewAssets")
                        .value(org.hamcrest.Matchers.contains(false)))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + c + "')].role")
                        .value(org.hamcrest.Matchers.contains("MANAGER")))
                .andExpect(jsonPath("$.estates[?(@.estateId == '" + c + "')].canViewAssets")
                        .value(org.hamcrest.Matchers.contains(true)))
                .andExpect(jsonPath("$.estates[*].address").isEmpty())
                .andExpect(jsonPath("$.estates[*].userId").isEmpty());
    }

    @Test
    void managementCollectionsExcludeResidentEstatesWhileManagersCanListAllEstateMembers() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Council estate", "owner-b");
        var c = estate("Owned estate", "mixed-user");
        membership("mixed-user", a, "RESIDENT");
        membership("mixed-user", b, "COUNCIL");
        membership("council-person", c, "COUNCIL");
        membership("resident-person", c, "RESIDENT");
        when(identity.user("council-person"))
                .thenReturn(
                        new CouncilIdentity.Person("council-person", "Council Person", "council@example.com", true));

        when(identity.user("resident-person"))
                .thenReturn(new CouncilIdentity.Person("resident-person", "Resident", "resident@example.com", true));
        when(identity.user("mixed-user"))
                .thenReturn(new CouncilIdentity.Person("mixed-user", "Manager", "manager@example.com", true));
        mvc.perform(asUser(get("/estates"), "mixed-user", "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.id == '" + a + "')]").isEmpty());
        mvc.perform(asUser(get("/dashboard/summary"), "mixed-user", "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessibleEstateCount").value(2))
                .andExpect(jsonPath("$.councilMemberCount").value(1));
        mvc.perform(asUser(get("/estates/" + c + "/members"), "mixed-user", "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.userId == 'resident-person')].role")
                        .value(org.hamcrest.Matchers.contains("RESIDENT")));
    }

    @Test
    void authorizedEstateParametersCannotExposeAnotherEstatesAssetsOrDevices() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Owned estate", "mixed-user");
        membership("mixed-user", a, "RESIDENT");
        var privateAsset = asset(a);
        var ownAsset = asset(b);
        mvc.perform(asUser(get("/estates/" + b + "/assets/" + privateAsset), "mixed-user", "user"))
                .andExpect(status().isNotFound());
        mvc.perform(asUser(get("/estates/" + b + "/assets/" + privateAsset + "/devices"), "mixed-user", "user"))
                .andExpect(status().isNotFound());
        mvc.perform(asUser(get("/estates/" + a + "/assets/" + ownAsset), "mixed-user", "user"))
                .andExpect(status().isForbidden());
    }

    @Test
    void deletingResidencyDoesNotRemoveCouncilAccessElsewhereWithTheSameToken() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Council estate", "owner-b");
        membership("mixed-user", a, "RESIDENT");
        membership("mixed-user", b, "COUNCIL");
        var token = jwt().jwt(value -> value.subject("mixed-user").claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
        mvc.perform(get("/access/context").with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmitReport").value(true));
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='mixed-user'", a);
        mvc.perform(get("/access/context").with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmitReport").value(false))
                .andExpect(jsonPath("$.hasResidentMembership").value(false))
                .andExpect(jsonPath("$.canEnterWorkspace").value(true));
        mvc.perform(get("/estates/" + a).with(token)).andExpect(status().isNotFound());
        mvc.perform(get("/estates/" + b).with(token)).andExpect(status().isOk());
        assertEquals(
                "COUNCIL",
                db.fetchValue("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='mixed-user'", b));
    }

    @Test
    void sameEstateResidentAndOwnershipConflictFailsClosedWithoutBlockingOtherOwnership() throws Exception {
        var a = estate("Conflicting estate", "mixed-user");
        var b = estate("Owned estate", "mixed-user");
        membership("mixed-user", a, "RESIDENT");
        var privateAsset = asset(a);
        mvc.perform(asUser(get("/estates/" + a), "mixed-user", "user")).andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + a + "/assets/" + privateAsset), "mixed-user", "user"))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + b), "mixed-user", "user")).andExpect(status().isOk());
    }

    @Test
    void providerAdminClaimsDoNotGrantGlobalOrEstateManagementAccess() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Other estate", "owner-b");
        membership("mixed-user", a, "RESIDENT");
        mvc.perform(asUser(get("/api/admin/users/mixed-user/estates"), "mixed-user", "admin"))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + a), "mixed-user", "admin")).andExpect(status().isForbidden());
        mvc.perform(asUser(get("/estates/" + b), "mixed-user", "admin")).andExpect(status().isNotFound());
        mvc.perform(asUser(get("/api/admin/users/mixed-user/estates"), "mixed-user", "user"))
                .andExpect(status().isForbidden());
    }

    @Test
    void genericAdminGrantsAreRetiredAndPreserveEveryExistingMembership() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Other estate", "owner-b");
        membership("resident-a", a, "RESIDENT");
        for (var request : new MockHttpServletRequestBuilder[] {
            put("/api/admin/users/resident-a/estates/" + a), delete("/api/admin/users/resident-a/estates/" + a),
            put("/api/admin/users/resident-a/estates/" + b), get("/api/admin/users/resident-a/estates")
        }) mvc.perform(asUser(request, "platform-admin", "admin")).andExpect(status().isForbidden());
        assertEquals(
                "RESIDENT",
                db.fetchValue("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='resident-a'", a));
        assertFalse(db.fetchExists(
                org.jooq.impl.DSL.table("\"EstateUser\""),
                org.jooq
                        .impl
                        .DSL
                        .field("\"estateId\"")
                        .eq(b)
                        .and(org.jooq.impl.DSL.field("\"userId\"").eq("resident-a"))));
    }

    @Test
    void councilAcceptanceElsewherePreservesResidencyAndCannotConvertItInTheSameEstate() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Council estate", "owner-b");
        membership("resident-a", a, "RESIDENT");
        when(identity.user("resident-a"))
                .thenReturn(new CouncilIdentity.Person("resident-a", "Resident", "resident@example.com", true));
        var sameEstate = invitation(a, "owner-a", "resident@example.com");
        var otherEstate = invitation(b, "owner-b", "resident@example.com");
        mvc.perform(asUser(post("/council-invitations/" + sameEstate + "/accept"), "resident-a", "user"))
                .andExpect(status().isConflict());
        mvc.perform(asUser(post("/council-invitations/" + otherEstate + "/accept"), "resident-a", "user"))
                .andExpect(status().isOk());
        assertEquals(
                "RESIDENT",
                db.fetchValue("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='resident-a'", a));
        assertEquals(
                "COUNCIL",
                db.fetchValue("select role from \"EstateUser\" where \"estateId\"=? and \"userId\"='resident-a'", b));
        assertEquals("IN_APP", db.fetchValue("select status from \"EstateInvitation\" where id=?", sameEstate));
    }

    @Test
    void databaseAllowsResidentMembershipInTwoEstates() {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Second estate", "owner-b");
        membership("resident-a", a, "RESIDENT");
        membership("resident-a", b, "RESIDENT");
        assertEquals(
                2,
                db.fetchCount(
                        org.jooq.impl.DSL.table("\"EstateUser\""),
                        org.jooq.impl.DSL.field("\"userId\"").eq("resident-a")));
    }

    @Test
    void databaseRejectsInvitationDelegationOnAResidentRow() {
        var a = estate("Resident estate", "owner-a");
        membership("resident-a", a, "RESIDENT");
        assertThrows(
                DataAccessException.class,
                () -> db.execute(
                        "update \"EstateUser\" set \"canInviteMembers\"=true where \"estateId\"=? and \"userId\"='resident-a'",
                        a));
    }

    @Test
    void membershipSchemaHasNoRevocationColumnOrLegacyAssignmentTable() {
        assertEquals(
                0L,
                db.fetchValue(
                        "select count(*) from information_schema.columns where table_schema='public' and table_name='EstateUser' and column_name='revokedAt'",
                        Long.class));
        assertEquals(
                0L,
                db.fetchValue(
                        "select count(*) from information_schema.tables where table_schema='public' and table_name='ResidentAssignment'",
                        Long.class));
    }

    @Test
    void changingTheDatabaseRoleUpdatesPermissionsAndKeepsHistoryWithTheSameToken() throws Exception {
        var a = estate("Resident estate", "owner-a");
        membership("resident-a", a, "RESIDENT");
        var location = reportLocation(a);
        var reportId = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReport\" (id, \"submittedByUserId\", \"estateId\", \"locationId\", title, description, \"updatedAt\") values (?, 'resident-a', ?, ?, 'Earlier fault', 'Earlier fault', now())",
                reportId,
                a,
                location);
        var token = jwt().jwt(value -> value.subject("resident-a").claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
        mvc.perform(get("/estates/" + a).with(token)).andExpect(status().isForbidden());
        db.execute("update \"EstateUser\" set role='COUNCIL' where \"estateId\"=? and \"userId\"='resident-a'", a);
        mvc.perform(get("/estates/" + a).with(token)).andExpect(status().isOk());
        mvc.perform(get("/resident/context").with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmit").value(false));
        mvc.perform(get("/resident/reports/" + reportId).with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Earlier fault"));
    }

    @Test
    void residentElsewhereCannotInviteThroughLegacyCouncilDelegation() throws Exception {
        var a = estate("Resident estate", "owner-a");
        var b = estate("Council estate", "owner-b");
        membership("mixed-user", a, "RESIDENT");
        membership("mixed-user", b, "COUNCIL");
        membership("other-council", b, "COUNCIL");
        db.execute(
                "update \"EstateUser\" set \"canInviteMembers\"=true where \"estateId\"=? and \"userId\"='mixed-user'",
                b);
        when(identity.user("owner-b"))
                .thenReturn(new CouncilIdentity.Person("owner-b", "Owner", "owner@example.com", true));
        when(identity.user("mixed-user"))
                .thenReturn(new CouncilIdentity.Person("mixed-user", "Delegate", "mixed@example.com", true));
        when(identity.user("other-council"))
                .thenReturn(new CouncilIdentity.Person("other-council", "Council", "council@example.com", true));
        when(identity.send(any(), eq("new@example.com"), eq("mixed-user")))
                .thenReturn(new CouncilIdentity.Invitation(
                        "inv_mixed",
                        "new@example.com",
                        "pending",
                        OffsetDateTime.now().plusDays(1),
                        null,
                        null));
        mvc.perform(asUser(post("/estates/" + b + "/council-invitations"), "mixed-user", "resident")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"new@example.com\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(
                                put("/estates/" + b + "/members/other-council/invitation-permission"),
                                "mixed-user",
                                "resident")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"canInviteMembers\":true}"))
                .andExpect(status().isForbidden());
        mvc.perform(asUser(post("/estates/" + a + "/council-invitations"), "mixed-user", "user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"new@example.com\"}"))
                .andExpect(status().isForbidden());
        assertEquals(
                false,
                db.fetchValue(
                        "select \"canInviteMembers\" from \"EstateUser\" where \"estateId\"=? and \"userId\"='other-council'",
                        b));
    }

    @Test
    void owningAnEstateDoesNotGrantAccessToAnotherResidentsReportOrImage() throws Exception {
        var a = estate("Owned estate", "owner");
        var location = reportLocation(a);
        var report = UUID.randomUUID();
        var image = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReport\" (id, \"submittedByUserId\", \"estateId\", \"locationId\", title, description, \"updatedAt\") values (?, 'resident-a', ?, ?, 'Private fault', 'Private fault', now())",
                report,
                a,
                location);
        db.execute(
                "insert into \"IssueReportImage\" (id, \"reportId\", \"storageKey\", \"contentType\", \"sizeBytes\") values (?, ?, 'private/owner-cannot-read', 'image/png', 3)",
                image,
                report);
        mvc.perform(asUser(get("/resident/reports/" + report), "owner", "user")).andExpect(status().isNotFound());
        mvc.perform(asUser(get("/resident/reports/" + report + "/images/" + image), "owner", "user"))
                .andExpect(status().isNotFound());
    }
}
