package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ReadingCsvExportIntegrationTests {
    static final String HEADER =
            "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estate, location, asset, device;
    List<UUID> estates = new ArrayList<>();
    String path;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = fixture("csv-owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        device = data.device(estate, location, asset, null);
        path = "/estates/" + estate + "/readings/export";
    }

    UUID[] fixture(String user) {
        var ids = data.estateWithAsset(user);
        estates.add(ids[0]);
        return ids;
    }

    @AfterEach
    void cleanup() {
        for (var id : estates) {
            for (var table : List.of("DeviceReading", "ManualReading", "Device", "Asset", "Location", "EstateUser"))
                db.execute("delete from \"" + table + "\" where \"estateId\"=?", id);
            db.execute("delete from \"Estate\" where id=?", id);
        }
    }

    UUID sensor(String metric, String value, String time) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"DeviceReading\" (id,\"estateId\",\"assetId\",\"deviceId\",metric,value,\"measuredAt\",\"receivedAt\") values (?,?,?,?,?,?,?::timestamptz,'2026-10-02T00:00:00Z')",
                id,
                estate,
                asset,
                device,
                metric,
                new BigDecimal(value),
                time);
        return id;
    }

    UUID manual(String value, String time, String name) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"ManualReading\" (id,\"estateId\",\"assetId\",metric,value,\"measuredAt\",\"recordedAt\",\"recordedByUserId\",\"recordedByName\",\"submissionId\") values (?,?,?,'TEMPERATURE',?,?::timestamptz,'2026-10-02T01:00:00Z','technician',?,?)",
                id,
                estate,
                asset,
                new BigDecimal(value),
                time,
                name,
                UUID.randomUUID());
        return id;
    }

    MockHttpServletRequestBuilder request(String user) {
        return get(path).with(jwt().jwt(j -> j.subject(user)));
    }

    org.springframework.mock.web.MockHttpServletResponse export(MockHttpServletRequestBuilder request)
            throws Exception {
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        assertThat(result.getRequest().isAsyncStarted()).isTrue();
        result.getAsyncResult(20000);
        return mvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse();
    }

    List<List<String>> rows(String csv) {
        if (csv.startsWith("\uFEFF")) csv = csv.substring(1);
        var rows = new ArrayList<List<String>>();
        var row = new ArrayList<String>();
        var cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < csv.length(); i++) {
            char c = csv.charAt(i);
            if (c == '"') {
                if (quoted && i + 1 < csv.length() && csv.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else quoted = !quoted;
            } else if (c == ',' && !quoted) {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (c == '\r' && !quoted && i + 1 < csv.length() && csv.charAt(i + 1) == '\n') {
                row.add(cell.toString());
                rows.add(List.copyOf(row));
                row.clear();
                cell.setLength(0);
                i++;
            } else cell.append(c);
        }
        assertThat(quoted).isFalse();
        assertThat(cell).isEmpty();
        return rows;
    }

    @Test
    void startsWithUtf8BomForExcelAndPreservesCelsius() throws Exception {
        sensor("TEMPERATURE", "25", "2026-10-01T00:00:00Z");
        var response = export(request("csv-owner"));
        assertThat(response.getContentAsByteArray()).startsWith((byte) 0xEF, (byte) 0xBB, (byte) 0xBF);
        var csv = response.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFF" + HEADER + "\r\n");
        assertThat(csv.chars().filter(c -> c == '\uFEFF').count()).isEqualTo(1);
        assertThat(rows(csv).get(1).get(7)).isEqualTo("°C");
    }

    @Test
    void exportsAllMixedRowsWithoutPaginationAndWithCompletionCount() throws Exception {
        for (int i = 0; i < 55; i++) sensor("TEMPERATURE", "20", "2026-10-01T00:00:" + String.format("%02d", i) + "Z");
        var manual = manual("-0.123456", "2026-10-01T01:00:00.123456Z", "Alex Tan");
        var response = export(request("csv-owner").param("page", "12").param("size", "1"));
        var csv = response.getContentAsString(StandardCharsets.UTF_8);
        var parsed = rows(csv);
        assertThat(parsed).hasSize(57);
        assertThat(parsed.get(0)).containsExactly(HEADER.split(","));
        assertThat(response.getHeader("X-Export-Row-Count")).isEqualTo("56");
        assertThat(response.getContentType()).startsWith("text/csv");
        assertThat(response.getHeader("Cache-Control")).isEqualTo("private, no-store");
        assertThat(response.getHeader("Content-Disposition")).contains("attachment", "readings-v1-" + estate);
        assertThat(parsed.get(1))
                .containsExactly(
                        manual.toString(),
                        "2026-10-01T01:00:00.123456Z",
                        asset.toString(),
                        parsed.get(1).get(3),
                        "Water Pump",
                        "TEMPERATURE",
                        "-0.123456",
                        "°C",
                        "MANUAL",
                        "",
                        "",
                        "technician",
                        "Alex Tan",
                        "2026-10-02T01:00:00.000000Z",
                        "");
        assertThat(parsed.get(2).get(8)).isEqualTo("SENSOR");
        assertThat(parsed.get(2).subList(11, 13)).containsExactly("", "");
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void supportsNonOwnerReadingRoles(String role) throws Exception {
        db.execute("insert into \"EstateUser\" (\"estateId\",\"userId\",role) values (?,'csv-reader',?)", estate, role);
        sensor("TEMPERATURE", "21", "2026-10-01T00:00:00Z");
        assertThat(rows(export(request("csv-reader")).getContentAsString(StandardCharsets.UTF_8)))
                .hasSize(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"RESIDENT", "COUNCIL", "MEMBER"})
    void deniesOtherRoles(String role) throws Exception {
        db.execute("insert into \"EstateUser\" (\"estateId\",\"userId\",role) values (?,'csv-reader',?)", estate, role);
        mvc.perform(request("csv-reader")).andExpect(status().isForbidden());
    }

    @Test
    void requiresAuthenticationAndForeignEstatesStayHidden() throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(request("stranger")).andExpect(status().isNotFound());
        var foreign = fixture("csv-owner");
        mvc.perform(request("csv-owner").param("assetId", foreign[2].toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void combinesMetricAssetHalfOpenTimesAndSuspectFiltersLikeTheList() throws Exception {
        sensor("TEMPERATURE", "20", "2026-10-01T00:00:00Z");
        var expected = sensor("TEMPERATURE", "151", "2026-10-01T00:05:00Z");
        manual("22", "2026-10-01T00:05:00Z", null);
        sensor("PRESSURE", "4", "2026-10-01T00:06:00Z");
        sensor("TEMPERATURE", "160", "2026-10-01T00:10:00Z");
        var response = export(request("csv-owner")
                .param("assetId", asset.toString())
                .param("metric", "TEMPERATURE")
                .param("from", "2026-10-01T00:05:00Z")
                .param("to", "2026-10-01T00:10:00Z")
                .param("flag", "OUT_OF_RANGE"));
        var csv = rows(response.getContentAsString(StandardCharsets.UTF_8));
        assertThat(csv).hasSize(2);
        assertThat(csv.get(1).get(0)).isEqualTo(expected.toString());
        assertThat(csv.get(1).get(14)).isEqualTo("GAP;DUPLICATE_TIMESTAMP;OUT_OF_RANGE");
    }

    @Test
    void exportsRetiredHistoryAndAHeaderOnlyForNoMatches() throws Exception {
        sensor("TEMPERATURE", "0", "2026-10-01T00:00:00Z");
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", asset);
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        assertThat(rows(export(request("csv-owner")).getContentAsString(StandardCharsets.UTF_8)))
                .hasSize(2);
        var empty = export(request("csv-owner").param("metric", "PRESSURE"));
        assertThat(empty.getContentAsString(StandardCharsets.UTF_8)).isEqualTo("\uFEFF" + HEADER + "\r\n");
        assertThat(empty.getHeader("X-Export-Row-Count")).isEqualTo("0");
    }

    @Test
    void quotesUnicodeCommasQuotesAndNewlinesAndEscapesSpreadsheetTextReversibly() throws Exception {
        db.execute("update \"Asset\" set name=? where id=?", "Water, \"泵\"\nRoom", asset);
        manual("0", "2026-10-01T08:00:00.123456+08:00", " \t=HYPERLINK(\"unsafe\")");
        var parsed = rows(export(request("csv-owner")).getContentAsString(StandardCharsets.UTF_8));
        assertThat(parsed.get(1).get(4)).isEqualTo("Water, \"泵\"\nRoom");
        assertThat(parsed.get(1).get(6)).isEqualTo("0.000000");
        assertThat(parsed.get(1).get(1)).isEqualTo("2026-10-01T00:00:00.123456Z");
        assertThat(parsed.get(1).get(12)).isEqualTo("' \t=HYPERLINK(\"unsafe\")");
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "metric=UNKNOWN",
                "flag=BOGUS",
                "assetId=bad",
                "from=yesterday",
                "from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z"
            })
    void rejectsBadFiltersBeforeStreaming(String query) throws Exception {
        mvc.perform(get(path + "?" + query).with(jwt().jwt(j -> j.subject("csv-owner"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exposesDownloadHeadersToTheWebOrigin() throws Exception {
        var response = export(request("csv-owner").header("Origin", "http://localhost:3001"));
        assertThat(response.getHeader("Access-Control-Expose-Headers"))
                .contains("Content-Disposition", "X-Export-Row-Count");
    }

    @Autowired
    org.springframework.context.ApplicationContext context;

    @Test
    void reportsBusyCapacityAsJsonBeforeSendingCsv() throws Exception {
        var executor = context.getBean(
                "readingExportExecutor", org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor.class);
        var started = new java.util.concurrent.CountDownLatch(2);
        var release = new java.util.concurrent.CountDownLatch(1);
        Runnable block = () -> {
            started.countDown();
            try {
                release.await();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        };
        executor.execute(block);
        executor.execute(block);
        try {
            assertThat(started.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            var initial = mvc.perform(request("csv-owner")).andReturn();
            var completed = initial;
            if (initial.getRequest().isAsyncStarted()) {
                initial.getAsyncResult(5000);
                completed = mvc.perform(asyncDispatch(initial)).andReturn();
            }
            assertThat(completed.getResponse().getStatus()).isEqualTo(503);
            assertThat(completed.getResponse().getContentType()).startsWith("application/json");
            new org.springframework.test.util.JsonPathExpectationsHelper("$.message")
                    .assertValue(
                            completed.getResponse().getContentAsString(),
                            "Reading exports are busy. Please retry shortly.");
        } finally {
            release.countDown();
        }
    }

    @Test
    void advertisesTheCompletionHeaderInTheGeneratedContract() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath(
                                "$.paths['/estates/{estateId}/readings/export'].get.responses['200'].headers['X-Export-Row-Count']")
                        .exists());
    }

    @Autowired
    com.proj.server.reading.ReadingExportService streaming;

    @Autowired
    javax.sql.DataSource source;

    @Test
    void aConcurrentSubmissionDoesNotChangeTheOpenExportSnapshot() throws Exception {
        sensor("TEMPERATURE", "21", "2026-10-01T00:00:00Z");
        var response = new org.springframework.mock.web.MockHttpServletResponse();
        var bytes = new java.io.ByteArrayOutputStream();
        var inserted = new java.util.concurrent.atomic.AtomicBoolean();
        var sink = new java.io.OutputStream() {
            @Override
            public void write(int value) {
                bytes.write(value);
            }

            @Override
            public void write(byte[] buffer, int offset, int length) throws java.io.IOException {
                if (inserted.compareAndSet(false, true)) {
                    try {
                        java.util.concurrent.CompletableFuture.runAsync(
                                        () -> manual("22", "2026-10-01T01:00:00Z", "New recorder"))
                                .get(5, java.util.concurrent.TimeUnit.SECONDS);
                    } catch (Exception error) {
                        throw new java.io.IOException(error);
                    }
                }
                bytes.write(buffer, offset, length);
            }
        };
        streaming.write(estate, "csv-owner", null, null, null, null, java.util.Set.of(), response, sink);
        assertThat(response.getHeader("X-Export-Row-Count")).isEqualTo("1");
        assertThat(rows(bytes.toString(StandardCharsets.UTF_8))).hasSize(2);
        assertThat(rows(export(request("csv-owner")).getContentAsString(StandardCharsets.UTF_8)))
                .hasSize(3);
    }

    @Test
    void aBrokenOutputClosesTheDatabaseCursorAndTransaction() throws Exception {
        sensor("TEMPERATURE", "21", "2026-10-01T00:00:00Z");
        var broken = new java.io.OutputStream() {
            @Override
            public void write(int value) throws java.io.IOException {
                throw new java.io.IOException("Disconnected client");
            }
        };
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> streaming.write(
                        estate,
                        "csv-owner",
                        null,
                        null,
                        null,
                        null,
                        java.util.Set.of(),
                        new org.springframework.mock.web.MockHttpServletResponse(),
                        broken))
                .isInstanceOf(java.io.IOException.class);
        org.awaitility.Awaitility.await()
                .atMost(java.time.Duration.ofSeconds(5))
                .untilAsserted(() -> assertThat(source.unwrap(com.zaxxer.hikari.HikariDataSource.class)
                                .getHikariPoolMXBean()
                                .getActiveConnections())
                        .isZero());
        assertThat(export(request("csv-owner")).getHeader("X-Export-Row-Count")).isEqualTo("1");
    }
}
