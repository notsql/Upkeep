package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.apache.commons.csv.CSVFormat;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Exercises public contracts using committed fixtures in disposable, Prisma-migrated Postgres. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
abstract class ReadingImportTestSupport {
    static final String TIME = "2026-10-01T00:00:00Z";
    static final String HEADER = "asset_id,metric,measured_at,value\n";
    static final String SOURCE = "Vendor A — October 2026 extract";
    static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    DeviceTestData data;
    UUID estate, location, asset;
    final List<UUID> estates = new ArrayList<>();

    @BeforeEach
    void importFixtures() {
        data = new DeviceTestData(db);
        var ids = fixture("import-owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        member("manager", "MANAGER");
        member("crew", "CREW");
        member("resident", "RESIDENT");
        member("council", "COUNCIL");
    }

    UUID[] fixture(String owner) {
        var ids = data.estateWithAsset(owner);
        estates.add(ids[0]);
        return ids;
    }

    void member(String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    @AfterEach
    void removeOnlyImportFixtures() {
        // Import tables do not exist in the red phase; never create them in a test.
        for (var id : estates) {
            if (db.fetchValue("select to_regclass('public.\"ReadingImportRow\"')") != null) {
                db.execute(
                        "delete from \"ReadingImportRow\" where \"batchId\" in (select id from \"ReadingImportBatch\" where \"estateId\"=?)",
                        id);
            }
            for (var table : List.of(
                    "ImportedReading",
                    "ReadingImportBatch",
                    "DeviceReading",
                    "ManualReading",
                    "Device",
                    "Asset",
                    "Location",
                    "EstateUser")) {
                if (db.fetchValue("select to_regclass(?)", "public.\"" + table + "\"") != null) {
                    db.execute("delete from \"" + table + "\" where \"estateId\"=?", id);
                }
            }
            db.execute("delete from \"Estate\" where id=?", id);
        }
        estates.clear();
    }

    String readings() {
        return "/estates/" + estate + "/readings";
    }

    String imports() {
        return readings() + "/imports";
    }

    String batchPath(JsonNode batch) {
        return imports() + "/" + batch.path("id").asText();
    }

    String row(String value, String time) {
        return asset + ",TEMPERATURE," + time + "," + value + "\n";
    }

    String csv(String value) {
        return HEADER + row(value, TIME);
    }

    ObjectNode options(UUID submission) {
        var options = JSON.createObjectNode();
        options.put("submissionId", submission.toString());
        options.put("sourceLabel", SOURCE);
        options.put("preset", "VENDOR");
        options.put("assetLookupMode", "asset_id");
        var mapping = options.putObject("mapping");
        for (var field : List.of("asset_id", "metric", "measured_at", "value")) mapping.put(field, field);
        return options;
    }

    MockMultipartHttpServletRequestBuilder upload(byte[] bytes, ObjectNode options) {
        return multipart(imports())
                .file(new MockMultipartFile("file", "vendor.csv", "text/csv", bytes))
                .file(new MockMultipartFile("options", "", "application/json", JSON.writeValueAsBytes(options)));
    }

    ResultActions submit(String user, String csv, ObjectNode options) throws Exception {
        return mvc.perform(upload(csv.getBytes(StandardCharsets.UTF_8), options).with(jwt().jwt(j -> j.subject(user))));
    }

    JsonNode importCsv(String csv) throws Exception {
        return body(submit("import-owner", csv, options(UUID.randomUUID())).andExpect(status().isCreated()));
    }

    JsonNode body(ResultActions response) throws Exception {
        return JSON.readTree(response.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    ResultActions read(String path, String user) throws Exception {
        return mvc.perform(get(path).with(jwt().jwt(j -> j.subject(user))));
    }

    JsonNode list() throws Exception {
        return body(read(readings(), "import-owner").andExpect(status().isOk()));
    }

    JsonNode rows(JsonNode batch) throws Exception {
        return body(read(batchPath(batch) + "/rows", "import-owner").andExpect(status().isOk()));
    }

    ResultActions revert(JsonNode batch, String user, String reason) throws Exception {
        return mvc.perform(post(batchPath(batch) + "/revert")
                .with(jwt().jwt(j -> j.subject(user)))
                .contentType("application/json")
                .content(JSON.writeValueAsBytes(JSON.createObjectNode().put("reason", reason))));
    }

    String export() throws Exception {
        var result = read(readings() + "/export", "import-owner")
                .andExpect(status().isOk())
                .andReturn();
        result.getAsyncResult(20_000);
        return mvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    List<List<String>> csvRecords(String csv) throws Exception {
        if (csv.startsWith("\uFEFF")) csv = csv.substring(1);
        try (var parser = CSVFormat.RFC4180.parse(new StringReader(csv))) {
            return parser.getRecords().stream().map(record -> record.toList()).toList();
        }
    }

    void counts(JsonNode batch, int total, int imported, int duplicate, int invalid, int warnings) {
        assertThat(batch.path("totalRows").asInt(-1)).isEqualTo(total);
        assertThat(batch.path("importedRows").asInt(-1)).isEqualTo(imported);
        assertThat(batch.path("duplicateRows").asInt(-1)).isEqualTo(duplicate);
        assertThat(batch.path("invalidRows").asInt(-1)).isEqualTo(invalid);
        assertThat(batch.path("warningRows").asInt(-1)).isEqualTo(warnings);
    }
}
