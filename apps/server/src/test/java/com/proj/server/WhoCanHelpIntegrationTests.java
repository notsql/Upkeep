package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** "Who can help" names the roles that pass each action's own guard (spec plain-english-wording.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class WhoCanHelpIntegrationTests {
    /** Each member and the role name the answer should use for them. */
    static final Map<String, String> MEMBERS = new LinkedHashMap<>();

    static {
        MEMBERS.put("owner", "estate owner");
        MEMBERS.put("manager", "Manager");
        MEMBERS.put("crew", "Crew");
        MEMBERS.put("council", "Council");
        MEMBERS.put("member", "Member");
        MEMBERS.put("resident", "Resident");
        MEMBERS.put("lead", "Facilities lead");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, locationId, assetId, deviceId, alertId;

    @BeforeEach
    void setup() {
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = data.device(estateId, locationId, assetId, null);
        membership("manager", "MANAGER");
        membership("crew", "CREW");
        membership("council", "COUNCIL");
        membership("member", "MEMBER");
        membership("resident", "RESIDENT");
        var roleId = UUID.randomUUID();
        db.execute(
                "insert into \"EstateRoleDefinition\" (id, \"estateId\", name, \"normalizedName\", \"createdByUserId\", \"updatedAt\") values (?, ?, 'Facilities lead', 'facilities lead', 'owner', now())",
                roleId,
                estateId);
        db.execute(
                "insert into \"EstateRolePermission\" (\"roleId\", permission) select ?, code from \"Permission\"",
                roleId);
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role, \"customRoleId\") values (?, 'lead', 'CUSTOM', ?)",
                estateId,
                roleId);
        alertId = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, condition, \"medianScore\", \"maxScore\", \"firstDetectedAt\", \"lastDetectedAt\", explanation, response) values (?, ?, ?, 'ANOMALY', 'Abnormal readings', 'NEEDS_ATTENTION', 0.74, 0.91, now(), now(), 'Unusual.', 'NONE')",
                alertId,
                estateId,
                assetId);
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    @SuppressWarnings("unchecked")
    List<String> roles(String user, String action) throws Exception {
        var body = mvc.perform(get("/estates/" + estateId + "/who-can-help")
                        .param("action", action)
                        .with(jwt().jwt(j -> j.subject(user))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value(action))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return (List<String>) JsonPath.read(body, "$.roles");
    }

    /** A request to the endpoint that guards the action, valid apart from the estate being inactive. */
    MockHttpServletRequestBuilder probe(String action) {
        var asset = "/estates/" + estateId + "/assets/" + assetId;
        var device = "{\"identifier\":\"NEW-1\",\"model\":\"PT-100\",\"locationId\":\"" + locationId
                + "\",\"metrics\":[\"TEMPERATURE\"],\"reportingIntervalSeconds\":60}";
        return switch (action) {
            case "REPLACE_SENSOR" -> json(post(asset + "/devices/" + deviceId + "/replace"), device);
            case "GENERATE_CONNECTION_KEY" -> post(asset + "/devices/" + deviceId + "/credential");
            case "PAUSE_SENSOR_WARNINGS" ->
                json(
                        post("/estates/" + estateId + "/devices/" + deviceId + "/flatline-pauses/TEMPERATURE"),
                        "{\"durationMinutes\":60}");
            case "RECORD_CONDITION" ->
                json(
                        post(asset + "/assessments"),
                        "{\"condition\":\"GOOD\",\"assessedOn\":\""
                                + LocalDate.now().minusDays(1) + "\",\"notes\":\"Fine\"}");
            case "ACKNOWLEDGE_ALERT" -> json(post("/notifications/" + alertId + "/acknowledge"), "{}");
            case "REVIEW_DUPLICATE" ->
                json(
                        patch("/estates/" + estateId + "/reports/" + UUID.randomUUID() + "/duplicate"),
                        "{\"state\":\"CONFIRMED\",\"expectedState\":\"SUSPECTED\"}");
            case "SEND_CREW" -> json(post(asset + "/inspection-requests"), "{\"assignedToUserId\":\"crew\"}");
            case "SEND_CONTRACTOR" ->
                json(
                        post("/estates/" + estateId + "/work-orders"),
                        "{\"description\":\"Fix\",\"locationId\":\"" + locationId
                                + "\",\"category\":\"EQUIPMENT_FAULT\",\"priority\":\"LOW\",\"source\":\"MANUAL\"}");
            default -> throw new IllegalArgumentException(action);
        };
    }

    static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @ParameterizedTest
    @EnumSource(
            value = com.proj.server.help.HelpAction.class,
            names = {
                "REPLACE_SENSOR",
                "PAUSE_SENSOR_WARNINGS",
                "GENERATE_CONNECTION_KEY",
                "RECORD_CONDITION",
                "ACKNOWLEDGE_ALERT",
                "REVIEW_DUPLICATE",
                "SEND_CREW",
                "SEND_CONTRACTOR"
            })
    void everyRoleInTheAnswerPassesTheActionsOwnGuardAndNoOtherDoes(com.proj.server.help.HelpAction action)
            throws Exception {
        var answer = roles("crew", action.name());
        // Inactive, so a member who passes the permission check gets 409 and nothing changes.
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        for (var member : MEMBERS.entrySet()) {
            int status = mvc.perform(probe(action.name()).with(jwt().jwt(j -> j.subject(member.getKey()))))
                    .andReturn()
                    .getResponse()
                    .getStatus();
            boolean allowed = status == 409;
            if (!allowed) {
                assertEquals(true, status == 403 || status == 404, member.getKey() + " got " + status);
            }
            assertEquals(
                    allowed,
                    answer.contains(member.getValue()),
                    action + " for " + member.getKey() + " (" + status + ")");
        }
    }

    @Test
    void rolesComeInAFixedOrderWithTheOwnerLast() throws Exception {
        assertEquals(List.of("Manager", "estate owner"), roles("crew", "SEND_CONTRACTOR"));
        assertEquals(List.of("estate owner"), roles("member", "REPLACE_SENSOR"));
    }

    @Test
    void rolesNobodyHoldsAreLeftOut() throws Exception {
        db.execute("delete from \"EstateUser\" where \"estateId\" = ? and role = 'MANAGER'", estateId);
        assertEquals(List.of("estate owner"), roles("crew", "PAUSE_SENSOR_WARNINGS"));
        assertEquals(List.of(), roles("crew", "REVIEW_DUPLICATE"));
    }

    @Test
    void outsidersGetNotFound() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/who-can-help")
                        .param("action", "SEND_CREW")
                        .with(jwt().jwt(j -> j.subject("stranger"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void anUnknownActionIsABadRequest() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/who-can-help")
                        .param("action", "FLY")
                        .with(jwt().jwt(j -> j.subject("crew"))))
                .andExpect(status().isBadRequest());
    }
}
