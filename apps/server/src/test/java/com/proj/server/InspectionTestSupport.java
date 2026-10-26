package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** Exercise the proposed HTTP contract without depending on ungenerated Java/API types. */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "app.r2.endpoint=",
            "app.r2.access-id=",
            "app.r2.secret-access-key=",
            "app.r2.bucket-name="
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
abstract class InspectionTestSupport {
    static final String OWNER = "inspection-owner";
    static final ZoneId SINGAPORE = ZoneId.of("Asia/Singapore");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService identity;

    UUID[] asset() {
        return new DeviceTestData(db).estateWithAsset(OWNER);
    }

    void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    UUID location(UUID estate, String name) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id,\"estateId\",type,name,\"updatedAt\") values (?,?,'BLOCK',?,now())",
                id,
                estate,
                name);
        return id;
    }

    static LocalDate today() {
        return LocalDate.now(SINGAPORE);
    }

    static String inspections(UUID[] data) {
        return "/estates/" + data[0] + "/assets/" + data[2] + "/inspections";
    }

    MockMultipartHttpServletRequestBuilder submission(UUID[] data, String outcome, String date) {
        var request = multipart(inspections(data)).param("expectedLocationId", data[1].toString());
        if (outcome != null) request.param("outcome", outcome);
        if (date != null) request.param("inspectedOn", date);
        return request;
    }

    ResultActions save(UUID[] data, String user, String outcome) throws Exception {
        return mvc.perform(submission(data, outcome, today().toString()).with(jwt().jwt(t -> t.subject(user))));
    }

    String saved(UUID[] data, String outcome) throws Exception {
        return save(data, OWNER, outcome)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    ResultActions read(String path, String user) throws Exception {
        return mvc.perform(get(path).with(jwt().jwt(t -> t.subject(user))));
    }

    static String id(String body) {
        return JsonPath.read(body, "$.id");
    }

    long count(String table, UUID estate) {
        return db.fetchOne("select count(*) from \"" + table + "\" where \"estateId\"=?", estate)
                .get(0, Long.class);
    }

    void cleanup(UUID estate) {
        for (String table : List.of(
                "WorkOrderCompletionRevision",
                "WorkOrderCompletion",
                "WorkOrderStatusEvent",
                "WorkOrder",
                "AssetInspectionPhoto",
                "AssetInspectionResult",
                "Asset",
                "Location",
                "EstateUser")) {
            // New tables do not exist during the initial red run.
            if (db.fetchValue("select to_regclass(?)", "\"" + table + "\"") != null)
                db.execute("delete from \"" + table + "\" where \"estateId\"=?", estate);
        }
        db.execute("delete from \"Estate\" where id=?", estate);
    }
}
