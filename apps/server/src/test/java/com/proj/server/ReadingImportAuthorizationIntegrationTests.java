package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ReadingImportAuthorizationIntegrationTests extends ReadingImportTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"import-owner", "manager"})
    void ownerAndManagerCanImportAndAreGrantedBothCapabilities(String user) throws Exception {
        submit(user, csv("21"), options(UUID.randomUUID())).andExpect(status().isCreated());
        read("/access/context", user)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canImportReadings").value(true))
                .andExpect(jsonPath("$.estates[0].canRevertReadingImports").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "resident", "council"})
    void nonManagersCannotImportReadBatchHistoryReportsOrRollback(String user) throws Exception {
        var batch = importCsv(csv("21"));
        submit(user, csv("22"), options(UUID.randomUUID())).andExpect(status().isForbidden());
        for (var path :
                List.of(imports(), batchPath(batch), batchPath(batch) + "/rows", batchPath(batch) + "/report")) {
            read(path, user).andExpect(status().isForbidden());
        }
        revert(batch, user, "Unauthorized attempt").andExpect(status().isForbidden());
        read("/access/context", user)
                .andExpect(jsonPath("$.estates[0].canImportReadings").value(false))
                .andExpect(jsonPath("$.estates[0].canRevertReadingImports").value(false));
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void signedOutRequestsCannotUploadOrReadReports() throws Exception {
        mvc.perform(upload(csv("21").getBytes(StandardCharsets.UTF_8), options(UUID.randomUUID())))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(imports())).andExpect(status().isUnauthorized());
    }

    @Test
    void unrelatedUsersCannotDiscoverAnEstateOrItsBatches() throws Exception {
        var batch = importCsv(csv("21"));
        submit("stranger", csv("22"), options(UUID.randomUUID())).andExpect(status().isNotFound());
        read(batchPath(batch), "stranger").andExpect(status().isNotFound());
        revert(batch, "stranger", "Wrong estate").andExpect(status().isNotFound());
    }

    @Test
    void aBatchIdFromAnotherEstateCannotBeReadReportedOrReverted() throws Exception {
        var batch = importCsv(csv("21"));
        var original = estate;
        estate = fixture("import-owner")[0];
        for (var suffix : List.of("", "/rows", "/report"))
            read(batchPath(batch) + suffix, "import-owner").andExpect(status().isNotFound());
        revert(batch, "import-owner", "Cross-estate attempt").andExpect(status().isNotFound());
        estate = original;
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void deactivationBlocksNewImportsRetriesAndRollbacksButPreservesReadableReports() throws Exception {
        var opts = options(UUID.randomUUID());
        var batch = body(submit("import-owner", csv("21"), opts).andExpect(status().isCreated()));
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        submit("import-owner", csv("21"), opts).andExpect(status().isConflict());
        submit("manager", csv("22"), options(UUID.randomUUID())).andExpect(status().isConflict());
        revert(batch, "manager", "Inactive estate").andExpect(status().isConflict());
        for (var path : List.of(imports(), batchPath(batch), batchPath(batch) + "/rows", batchPath(batch) + "/report"))
            read(path, "manager").andExpect(status().isOk());
        read("/access/context", "import-owner")
                .andExpect(jsonPath("$.estates[0].canImportReadings").value(false))
                .andExpect(jsonPath("$.estates[0].canRevertReadingImports").value(false));
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void deactivationAlsoBlocksAnAlreadyCompletedRollbackRetry() throws Exception {
        var batch = importCsv(csv("21"));
        revert(batch, "manager", "Bad file").andExpect(status().isOk());
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        revert(batch, "manager", "Bad file").andExpect(status().isConflict());
        read(batchPath(batch), "import-owner").andExpect(jsonPath("$.status").value("REVERTED"));
    }

    @Test
    void revokingManagerMembershipTakesEffectOnSubmissionRetryAndRollback() throws Exception {
        var opts = options(UUID.randomUUID());
        var batch = body(submit("manager", csv("21"), opts).andExpect(status().isCreated()));
        db.execute("update \"EstateUser\" set role='CREW' where \"estateId\"=? and \"userId\"='manager'", estate);
        submit("manager", csv("21"), opts).andExpect(status().isForbidden());
        revert(batch, "manager", "Stale permissions").andExpect(status().isForbidden());
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void ordinaryReadingConsumersSeeProvenanceWithoutAdminUploaderDetails() throws Exception {
        importCsv(csv("21"));
        var reading = body(read(readings(), "crew").andExpect(status().isOk()))
                .path("items")
                .get(0);
        assertThat(reading.path("sourceLabel").asText()).isEqualTo(SOURCE);
        assertThat(reading.path("importBatchId").asText()).isNotBlank();
        assertThat(reading.has("uploaderUserId")).isFalse();
        assertThat(reading.has("uploaderName")).isFalse();
        assertThat(reading.has("mapping")).isFalse();
    }
}
