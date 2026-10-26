package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.jooq.impl.DSL;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class InspectionConcurrencyIntegrationTests extends InspectionTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"estate", "asset", "location", "membership", "move"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void queuedSubmissionRechecksAuthorityActivityAndObservedLocationAfterTheEstateLock(String change)
            throws Exception {
        var data = asset();
        try {
            member(data[0], "queued-inspector", "CREW");
            var alternative = location(data[0], "Block B");
            try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
                var pending = db.transactionResult(configuration -> {
                    var locked = DSL.using(configuration);
                    locked.fetch("select id from \"Estate\" where id=? for update", data[0]);
                    var blocker = locked.fetchValue("select pg_backend_pid()", Integer.class);
                    var request = requests.submit(() -> save(data, "queued-inspector", "FAIL")
                            .andReturn()
                            .getResponse()
                            .getStatus());
                    boolean blocked = false;
                    var deadline = Instant.now().plusSeconds(5);
                    while (!request.isDone() && Instant.now().isBefore(deadline)) {
                        blocked = Boolean.TRUE.equals(locked.fetchOne(
                                        "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
                                        blocker)
                                .get(0, Boolean.class));
                        if (blocked) break;
                    }
                    assertTrue(blocked, "Inspection writes must wait for the estate mutation before validating state");
                    switch (change) {
                        case "estate" ->
                            locked.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
                        case "asset" ->
                            locked.execute(
                                    "update \"Asset\" set \"deactivatedAt\"=now(),\"retiredOn\"=current_date,\"retirementReason\"='Retired' where id=?",
                                    data[2]);
                        case "location" ->
                            locked.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", data[1]);
                        case "membership" ->
                            locked.execute(
                                    "delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='queued-inspector'",
                                    data[0]);
                        case "move" ->
                            locked.execute("update \"Asset\" set \"locationId\"=? where id=?", alternative, data[2]);
                        default -> throw new IllegalArgumentException(change);
                    }
                    return request;
                });
                assertEquals(change.equals("membership") ? 404 : 409, pending.get(10, TimeUnit.SECONDS));
                assertEquals(0, count("AssetInspectionResult", data[0]));
                assertEquals(0, count("WorkOrder", data[0]));
            }
        } finally {
            cleanup(data[0]);
        }
    }
}
