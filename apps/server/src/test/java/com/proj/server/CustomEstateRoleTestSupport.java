package com.proj.server;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Issuereportimage.ISSUEREPORTIMAGE;
import static com.proj.server.db.tables.Location.LOCATION;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.estate.CouncilIdentity;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateRequest;
import com.proj.server.resident.ResidentImageStore;
import com.proj.server.workos.WorkOSService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** HTTP fixtures use today's types; new role contracts are exercised as JSON, before generation. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
abstract class CustomEstateRoleTestSupport {
    static final List<String> CODES = List.of(
            "VIEW_ESTATE",
            "EDIT_ESTATE",
            "VIEW_FAULT_REPORTS",
            "RELOCATE_FAULT_REPORTS",
            "INVITE_MEMBERS",
            "CREATE_LOCATIONS",
            "EDIT_LOCATIONS",
            "CREATE_ROLES",
            "EDIT_ROLES",
            "VIEW_DOCUMENTS",
            "EDIT_DOCUMENTS");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @Autowired
    EstateRepository estates;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService identity;

    @MockitoBean
    ResidentImageStore imageStore;

    final ObjectMapper json = new ObjectMapper();
    final Map<String, JwtRequestPostProcessor> tokens = new java.util.concurrent.ConcurrentHashMap<>();
    UUID estateId;

    @BeforeEach
    void createEstateAndPeople() {
        estateId = estate("owner");
        member(estateId, "manager", "MANAGER");
        member(estateId, "member", "COUNCIL");
        for (var user : List.of("owner", "manager", "member", "author", "recipient", "other")) {
            person(user, true);
        }
        when(identity.send(any(), anyString(), anyString()))
                .thenAnswer(call -> new CouncilIdentity.Invitation(
                        null,
                        call.getArgument(1),
                        "existing_account",
                        OffsetDateTime.now().plusDays(7),
                        null,
                        null));
    }

    UUID estate(String owner) {
        return estates.create(
                        owner,
                        new EstateRequest("Maple Estate", UUID.randomUUID().toString(), "Road", "123456", null))
                .id();
    }

    void person(String user, boolean verified) {
        when(identity.user(user)).thenReturn(new CouncilIdentity.Person(user, user, user + "@example.com", verified));
    }

    void member(UUID estate, String user, String role) {
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, user)
                .set(ESTATEUSER.ROLE, role)
                .execute();
    }

    void inactive() {
        db.update(ESTATE)
                .set(ESTATE.DEACTIVATEDAT, OffsetDateTime.now())
                .where(ESTATE.ID.eq(estateId))
                .execute();
    }

    UUID location(UUID estate, String type, UUID parent, String name, Integer position) {
        var id = UUID.randomUUID();
        var parentType = parent == null
                ? null
                : db.select(LOCATION.TYPE)
                        .from(LOCATION)
                        .where(LOCATION.ID.eq(parent))
                        .fetchSingle(LOCATION.TYPE);
        db.insertInto(LOCATION)
                .set(LOCATION.ID, id)
                .set(LOCATION.ESTATEID, estate)
                .set(LOCATION.TYPE, type)
                .set(LOCATION.PARENTID, parent)
                .set(LOCATION.PARENTTYPE, parentType)
                .set(LOCATION.NAME, name)
                .set(LOCATION.SORTORDER, position)
                .set(LOCATION.UPDATEDAT, OffsetDateTime.now())
                .execute();
        return id;
    }

    UUID report(UUID estate, UUID location, String submitter) {
        var id = UUID.randomUUID();
        var time = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        db.insertInto(ISSUEREPORT)
                .set(ISSUEREPORT.ID, id)
                .set(ISSUEREPORT.ESTATEID, estate)
                .set(ISSUEREPORT.LOCATIONID, location)
                .set(ISSUEREPORT.SUBMITTEDBYUSERID, submitter)
                .set(ISSUEREPORT.TITLE, "Leaking pipe")
                .set(ISSUEREPORT.DESCRIPTION, "Water near the lift")
                .set(ISSUEREPORT.STATUS, "SUBMITTED")
                .set(ISSUEREPORT.CREATEDAT, time)
                .set(ISSUEREPORT.UPDATEDAT, time)
                .execute();
        return id;
    }

    UUID image(UUID report) {
        var id = UUID.randomUUID();
        db.insertInto(ISSUEREPORTIMAGE)
                .set(ISSUEREPORTIMAGE.ID, id)
                .set(ISSUEREPORTIMAGE.REPORTID, report)
                .set(ISSUEREPORTIMAGE.STORAGEKEY, "private/" + id)
                .set(ISSUEREPORTIMAGE.CONTENTTYPE, "image/png")
                .set(ISSUEREPORTIMAGE.SIZEBYTES, 3)
                .execute();
        return id;
    }

    String path() {
        return "/estates/" + estateId;
    }

    String roles() {
        return path() + "/roles";
    }

    MockHttpServletRequestBuilder as(String user, MockHttpServletRequestBuilder request) {
        // A forged provider admin claim must never supply estate authority.
        return request.with(tokens.computeIfAbsent(
                user, subject -> jwt().jwt(token -> token.subject(subject).claim("role", "admin"))
                        .authorities(new SimpleGrantedAuthority("ROLE_admin"))));
    }

    ResultActions send(String user, MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mvc.perform(
                as(user, request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))));
    }

    JsonNode body(ResultActions response) throws Exception {
        return json.readTree(response.andReturn().getResponse().getContentAsString());
    }

    UUID id(JsonNode response) {
        return UUID.fromString(response.get("id").asText());
    }

    JsonNode create(String name, String... permissions) throws Exception {
        return body(send("owner", post(roles()), roleBody(name, permissions)).andExpect(status().isCreated()));
    }

    Map<String, Object> roleBody(String name, String... permissions) {
        return Map.of("name", name, "permissions", List.of(permissions));
    }

    Map<String, Object> updateBody(JsonNode role, String name, String... permissions) {
        return Map.of(
                "name",
                name,
                "permissions",
                List.of(permissions),
                "expectedVersion",
                role.get("version").asInt());
    }

    Map<String, Object> selector(JsonNode role) {
        return Map.of(
                "role",
                "CUSTOM",
                "customRoleId",
                role.get("id").asText(),
                "expectedRoleVersion",
                role.get("version").asInt());
    }

    ResultActions assign(String caller, String target, JsonNode role) throws Exception {
        return send(caller, put(path() + "/members/" + target + "/role"), selector(role));
    }

    JsonNode grant(String user, String... permissions) throws Exception {
        var role = create("Role for " + user, permissions);
        if (!db.fetchExists(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(user)))) {
            member(estateId, user, "COUNCIL");
        }
        assign("owner", user, role).andExpect(status().isOk());
        return role;
    }

    Map<String, Object> offer(JsonNode role, String email) {
        var payload = new java.util.HashMap<>(selector(role));
        payload.put("email", email);
        return payload;
    }

    JsonNode invite(String caller, JsonNode role) throws Exception {
        return body(send(caller, post(path() + "/council-invitations"), offer(role, "recipient@example.com"))
                .andExpect(status().isCreated()));
    }

    ResultActions accept(JsonNode invitation, JsonNode role) throws Exception {
        return send(
                "recipient",
                post("/council-invitations/" + id(invitation) + "/accept"),
                Map.of("expectedRoleVersion", role.get("version").asInt()));
    }
}
