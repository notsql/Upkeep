package com.proj.server;

import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;

class DocumentTypeFilterIntegrationTests extends DocumentTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"INVOICE", "SERVICE_REPORT"})
    void existingTypeFiltersCombineWithTrimmedCaseInsensitiveFilenameSearch(String type) throws Exception {
        uploadType("INVOICE", "match-invoice.pdf");
        uploadType("SERVICE_REPORT", "match-service.pdf");
        uploadType("INVOICE", "other-invoice.pdf");
        uploadType("SERVICE_REPORT", "other-service.pdf");
        String expected = type.equals("INVOICE") ? "match-invoice.pdf" : "match-service.pdf";
        mvc.perform(as("crew", get(documents()).param("documentType", type).param("filename", "  MATCH  ")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.items[*].originalFilename", contains(expected)))
                .andExpect(jsonPath("$.items[0].documentType").value(type))
                .andExpect(jsonPath("$.items[0].sizeBytes").isNumber());
    }

    @Test
    void typeIsAppliedBeforePaginationAndTypedCursorsCannotCrossFilterBoundaries() throws Exception {
        UUID old = id(uploadType("SERVICE_REPORT", "old-report.pdf"));
        UUID newer = id(uploadType("SERVICE_REPORT", "new-report.pdf"));
        db.execute("update \"Document\" set \"createdAt\"='2026-01-01T00:00:00Z' where id=?", old);
        db.execute("update \"Document\" set \"createdAt\"='2026-02-01T00:00:00Z' where id=?", newer);
        uploadType("INVOICE", "newest-invoice.pdf");
        var first = body(mvc.perform(as(
                        "crew",
                        get(documents()).param("documentType", "SERVICE_REPORT").param("limit", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(newer.toString())));
        String cursor = first.get("nextCursor").asText();
        mvc.perform(as(
                        "crew",
                        get(documents())
                                .param("documentType", "SERVICE_REPORT")
                                .param("limit", "1")
                                .param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(old.toString()))
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        mvc.perform(as("crew", get(documents()).param("documentType", "INVOICE").param("cursor", cursor)))
                .andExpect(status().isBadRequest());
        mvc.perform(as("crew", get(documents()).param("cursor", cursor))).andExpect(status().isBadRequest());
        mvc.perform(as(
                        "crew",
                        get(documents())
                                .param("documentType", "SERVICE_REPORT")
                                .param("filename", "report")
                                .param("cursor", cursor)))
                .andExpect(status().isBadRequest());
        UUID foreign = estate("crew");
        mvc.perform(as(
                        "crew",
                        get("/estates/" + foreign + "/documents")
                                .param("documentType", "SERVICE_REPORT")
                                .param("cursor", cursor)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void omittedTypeListsBothExistingTypesAndKeepsLegacyUnfilteredCursorsUsable() throws Exception {
        uploadType("INVOICE", "match-invoice.pdf");
        uploadType("SERVICE_REPORT", "match-service.pdf");
        var all = body(mvc.perform(as("crew", get(documents()).param("filename", "match")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2)));
        var first = all.get("items").get(0);
        String binding = estateId + "\n"
                + Base64.getUrlEncoder().withoutPadding().encodeToString("match".getBytes(StandardCharsets.UTF_8))
                + "\n";
        String legacy = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString((binding + first.get("createdAt").asText() + "\n"
                                + first.get("id").asText())
                        .getBytes(StandardCharsets.UTF_8));
        mvc.perform(as("crew", get(documents()).param("filename", "match").param("cursor", legacy)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id")
                        .value(all.get("items").get(1).get("id").asText()));
        mvc.perform(as(
                        "crew",
                        get(documents())
                                .param("filename", "match")
                                .param("documentType", "INVOICE")
                                .param("cursor", legacy)))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"OTHERS", "invoice", "UNKNOWN", "ALL"})
    void unsupportedApiTypesReturnBadRequest(String type) throws Exception {
        mvc.perform(as("crew", get(documents()).param("documentType", type)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void filtersExcludeDeletedAndForeignDocumentsBeforeLimitingThePage() throws Exception {
        UUID deleted = id(uploadType("INVOICE", "deleted.pdf"));
        uploadType("SERVICE_REPORT", "report.pdf");
        mvc.perform(as("crew", delete(documents() + "/" + deleted))).andExpect(status().isNoContent());
        UUID foreign = estate("owner");
        mvc.perform(as(
                        "owner",
                        multipart("/estates/" + foreign + "/documents")
                                .file(pdfFile("foreign.pdf"))
                                .param("documentType", "INVOICE")))
                .andExpect(status().isCreated());
        mvc.perform(as("crew", get(documents()).param("documentType", "INVOICE").param("limit", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        assertNotNull(db.fetchOne("select id from \"Document\" where id=?", deleted));
    }

    @Test
    void filteredReadsRetainHistoricalAccessAndLiveDocumentPermissionChecks() throws Exception {
        uploadType("INVOICE", "invoice.pdf");
        uploadType("SERVICE_REPORT", "report.pdf");
        inactive();
        mvc.perform(as("crew", get(documents()).param("documentType", "SERVICE_REPORT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].documentType", contains("SERVICE_REPORT")));
        mvc.perform(get(documents()).param("documentType", "SERVICE_REPORT")).andExpect(status().isUnauthorized());
        mvc.perform(as("resident", get(documents()).param("documentType", "SERVICE_REPORT")))
                .andExpect(status().isForbidden());
        mvc.perform(as("outsider", get(documents()).param("documentType", "SERVICE_REPORT")))
                .andExpect(status().isNotFound());
        revoke("crew");
        mvc.perform(as("crew", get(documents()).param("documentType", "SERVICE_REPORT")))
                .andExpect(status().isNotFound());
    }

    private JsonNode uploadType(String type, String filename) throws Exception {
        return body(mvc.perform(as("crew", submission(type, pdfFile(filename)))).andExpect(status().isCreated()));
    }
}
