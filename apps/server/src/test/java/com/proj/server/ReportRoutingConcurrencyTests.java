package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.proj.server.resident.ResidentImageStore;
import com.proj.server.routing.Classification;
import com.proj.server.routing.FaultClassifier;
import com.proj.server.routing.ReportClassificationJob;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Separate committed transactions are essential: one transaction cannot demonstrate two workers racing. */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "app.routing.initial-delay=PT1H"
        })
@Import(TestcontainersConfiguration.class)
class ReportRoutingConcurrencyTests {
    @Autowired
    DSLContext db;

    @Autowired
    ReportClassificationJob classification;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    ResidentImageStore imageStore;

    @MockitoBean
    FaultClassifier classifier;

    @Test
    void whileOneWorkerIsClassifyingAReportAnotherWorkerCannotClaimIt() throws Exception {
        var estate = UUID.randomUUID();
        var block = UUID.randomUUID();
        var report = UUID.randomUUID();
        db.execute("""
                insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                values (?, 'owner', 'Race Estate', ?, 'Road', '123456', now())
                """, estate, estate.toString());
        db.execute("""
                insert into "Location" (id, "estateId", type, name, "updatedAt")
                values (?, ?, 'BLOCK', 'Block A', now())
                """, block, estate);
        db.execute("""
                insert into "IssueReport" (id, "estateId", "locationId", "submittedByUserId", title, description,
                    status, "createdAt", "updatedAt")
                values (?, ?, ?, 'resident', 'Lift stuck', 'Doors', 'SUBMITTED', now(), now())
                """, report, estate, block);
        db.execute("""
                insert into "ReportRouting" ("reportId", "estateId", state, "nextAttemptAt", "updatedAt")
                values (?, ?, 'CLASSIFYING', now() - interval '1 second', now())
                """, report, estate);
        var classifying = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(classifier.available()).thenReturn(true);
        when(classifier.classify(any())).thenAnswer(call -> {
            classifying.countDown();
            assertTrue(release.await(10, TimeUnit.SECONDS));
            return Classification.of("NOT_EQUIPMENT", "NONE", 0.9, "Not equipment", "m");
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(classification::classifyNext);
            assertTrue(classifying.await(10, TimeUnit.SECONDS));

            var second = executor.submit(classification::classifyNext).get(10, TimeUnit.SECONDS);
            release.countDown();

            assertTrue(first.get(10, TimeUnit.SECONDS));
            assertEquals(false, second);
            verify(classifier, times(1)).classify(any());
            assertEquals(
                    "NEEDS_REVIEW", db.fetchValue("select state from \"ReportRouting\" where \"reportId\"=?", report));
        } finally {
            db.execute("delete from \"ReportClassification\" where \"reportId\"=?", report);
            db.execute("delete from \"ReportRouting\" where \"reportId\"=?", report);
            db.execute("delete from \"IssueReport\" where id=?", report);
            db.execute("delete from \"Location\" where id=?", block);
            db.execute("delete from \"Estate\" where id=?", estate);
        }
    }
}
