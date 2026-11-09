package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;

class ReadingImportConcurrencyIntegrationTests extends ReadingImportTestSupport {
    boolean failureConstraint;

    @AfterEach
    void removeFaultInjection() {
        if (failureConstraint)
            db.execute("alter table \"ReadingImportRow\" drop constraint if exists reading_import_test_failure");
    }

    @Test
    void simultaneousIdenticalSubmissionReturnsOneBatchAndOneMeasurement() throws Exception {
        var opts = options(UUID.randomUUID());
        var results = race(
                () -> body(submit("import-owner", csv("21"), opts).andExpect(status().is2xxSuccessful())),
                () -> body(submit("import-owner", csv("21"), opts).andExpect(status().is2xxSuccessful())));
        assertThat(results.get(0).path("id").asText()).isNotBlank();
        assertThat(results.get(0).path("id")).isEqualTo(results.get(1).path("id"));
        assertThat(body(read(imports(), "import-owner").andExpect(status().isOk()))
                        .path("totalItems")
                        .asInt())
                .isEqualTo(1);
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void simultaneousOverlappingFilesHaveOneInsertAndOneDuplicate() throws Exception {
        var results = race(() -> importCsv(csv("21")), () -> importCsv(csv("21")));
        assertThat(results.stream()
                        .mapToInt(batch -> batch.path("importedRows").asInt())
                        .sum())
                .isEqualTo(1);
        assertThat(results.stream()
                        .mapToInt(batch -> batch.path("duplicateRows").asInt())
                        .sum())
                .isEqualTo(1);
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void simultaneousConflictingValuesPreserveTheWinningMeasurement() throws Exception {
        var results = race(() -> importCsv(csv("21")), () -> importCsv(csv("22")));
        assertThat(results.stream()
                        .mapToInt(batch -> batch.path("importedRows").asInt())
                        .sum())
                .isEqualTo(1);
        assertThat(results.stream()
                        .mapToInt(batch -> batch.path("invalidRows").asInt())
                        .sum())
                .isEqualTo(1);
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
        assertThat(list().path("items").get(0).path("valueText").asText()).isIn("21", "22");
    }

    @ParameterizedTest
    @ValueSource(strings = {"estate", "asset", "membership"})
    void queuedImportRechecksLifecycleAndAuthorityAfterTheEstateLock(String change) throws Exception {
        try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
            var pending = db.transactionResult(configuration -> {
                var locked = DSL.using(configuration);
                locked.fetch("select id from \"Estate\" where id=? for update", estate);
                var blocker = locked.fetchOne("select pg_backend_pid()").get(0, Integer.class);
                var request = requests.submit(() ->
                        submit("manager", csv("21"), options(UUID.randomUUID())).andReturn());
                Awaitility.await()
                        .atMost(Duration.ofSeconds(5))
                        .until(() -> request.isDone()
                                || Boolean.TRUE.equals(locked.fetchOne(
                                                "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
                                                blocker)
                                        .get(0, Boolean.class)));
                assertThat(request.isDone())
                        .as("An import must wait for the estate write lock")
                        .isFalse();
                switch (change) {
                    case "estate" -> locked.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
                    case "asset" -> locked.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", asset);
                    case "membership" ->
                        locked.execute(
                                "update \"EstateUser\" set role='CREW' where \"estateId\"=? and \"userId\"='manager'",
                                estate);
                    default -> throw new IllegalArgumentException(change);
                }
                return request;
            });
            var response = pending.get(10, TimeUnit.SECONDS).getResponse();
            if (change.equals("asset")) {
                assertThat(response.getStatus()).isEqualTo(201);
                var batch = JSON.readTree(response.getContentAsString());
                counts(batch, 1, 0, 0, 1, 0);
                assertThat(rows(batch).path("items").get(0).path("issues").toString())
                        .contains("ASSET_RETIRED");
            } else assertThat(response.getStatus()).isEqualTo(change.equals("membership") ? 403 : 409);
            assertThat(list().path("totalItems").asInt()).isZero();
        }
    }

    @Test
    void rollbackQueuedBehindDeactivationCannotDeleteAnyReadings() throws Exception {
        var batch = importCsv(csv("21"));
        try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
            var pending = db.transactionResult(configuration -> {
                var locked = DSL.using(configuration);
                locked.fetch("select id from \"Estate\" where id=? for update", estate);
                var blocker = locked.fetchOne("select pg_backend_pid()").get(0, Integer.class);
                var request = requests.submit(
                        () -> revert(batch, "manager", "Queued rollback").andReturn());
                Awaitility.await()
                        .atMost(Duration.ofSeconds(5))
                        .until(() -> request.isDone()
                                || Boolean.TRUE.equals(locked.fetchOne(
                                                "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
                                                blocker)
                                        .get(0, Boolean.class)));
                assertThat(request.isDone())
                        .as("Rollback must wait for the estate write lock")
                        .isFalse();
                locked.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
                return request;
            });
            assertThat(pending.get(10, TimeUnit.SECONDS).getResponse().getStatus())
                    .isEqualTo(409);
        }
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void rowReportStorageFailureRollsBackReadingsAndAllowsTheSameSubmissionToRetry() throws Exception {
        // Establish feature availability before injecting a failure into its proposed report table.
        importCsv(csv("20"));
        db.execute(
                "alter table \"ReadingImportRow\" add constraint reading_import_test_failure check (false) not valid");
        failureConstraint = true;
        var opts = options(UUID.randomUUID());
        var file = HEADER + row("21", "2026-10-02T00:00:00Z");
        try {
            submit("import-owner", file, opts).andExpect(status().is5xxServerError());
            assertThat(list().path("totalItems").asInt()).isEqualTo(1);
            read(imports(), "import-owner")
                    .andExpect(
                            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.totalItems")
                                    .value(1));
        } finally {
            removeFaultInjection();
            failureConstraint = false;
        }
        counts(body(submit("import-owner", file, opts).andExpect(status().isCreated())), 1, 1, 0, 0, 0);
    }

    private List<JsonNode> race(Callable<JsonNode> first, Callable<JsonNode> second) throws Exception {
        var barrier = new CyclicBarrier(2);
        try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
            var left = requests.submit(() -> {
                barrier.await(5, TimeUnit.SECONDS);
                return first.call();
            });
            var right = requests.submit(() -> {
                barrier.await(5, TimeUnit.SECONDS);
                return second.call();
            });
            try {
                return List.of(left.get(20, TimeUnit.SECONDS), right.get(20, TimeUnit.SECONDS));
            } catch (ExecutionException failure) {
                if (failure.getCause() instanceof AssertionError assertion) throw assertion;
                throw failure;
            }
        }
    }
}
