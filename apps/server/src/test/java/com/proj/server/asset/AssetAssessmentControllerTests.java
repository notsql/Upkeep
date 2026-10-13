package com.proj.server.asset;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.config.SecurityConfig;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AssetassessmentRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(
        controllers = AssetAssessmentController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, AssetAssessmentService.class, AssetExceptionHandler.class})
class AssetAssessmentControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    AssetAssessmentRepository repository;

    @MockitoBean
    AssetRepository assets;

    @MockitoBean
    EstateRepository estates;

    @MockitoBean
    WorkOSService workOS;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID estateId = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");
    private final UUID assetId = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private final UUID locationId = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
    private final UUID unknownId = UUID.fromString("00000000-0000-0000-0000-0000000000ff");
    private final OffsetDateTime now = OffsetDateTime.parse("2026-09-28T00:00:00Z");
    private final String base = "/estates/" + estateId + "/assets/" + assetId + "/assessments";

    private EstateResponse estate(OffsetDateTime deactivatedAt) {
        return new EstateResponse(
                estateId, "Sunrise Court", "SUNRISE", "1 Sunrise Road", "123456", null, now, now, deactivatedAt, true);
    }

    private AssetRecord asset(OffsetDateTime deactivatedAt) {
        return new AssetRecord(
                assetId,
                estateId,
                locationId,
                "SUNRISE-A0001",
                "Booster pump",
                "PUMP",
                null,
                null,
                now,
                now,
                deactivatedAt,
                0,
                null,
                null,
                null,
                null);
    }

    private AssetassessmentRecord assessment(String condition, String assessedOn, String name) {
        return new AssetassessmentRecord(
                UUID.randomUUID(),
                estateId,
                assetId,
                condition,
                LocalDate.parse(assessedOn),
                "Checked on site.",
                "owner",
                name,
                now);
    }

    @BeforeEach
    void setup() {
        when(estates.findOwned(estateId, "owner", false)).thenReturn(Optional.of(estate(null)));
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(null)));
        when(assets.find(assetId, estateId, false)).thenReturn(Optional.of(asset(null)));
        when(assets.find(assetId, estateId, true)).thenReturn(Optional.of(asset(null)));
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Casey Doe"));
    }

    private static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(t -> t.subject(subject)));
    }

    private MockHttpServletRequestBuilder record(String json) {
        return as("owner", post(base)).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    private static String body(String condition, LocalDate assessedOn, String notes) {
        return """
                {"condition":"%s","assessedOn":"%s","notes":"%s"}""".formatted(condition, assessedOn, notes);
    }

    /** Echoes the create call back as the stored row, as the database would. */
    private void createEchoesTheRequest() {
        when(repository.create(eq(estateId), eq(assetId), any(), any(), any())).thenAnswer(call -> {
            CreateAssetAssessmentRequest request = call.getArgument(2);
            return new AssetassessmentRecord(
                    UUID.randomUUID(),
                    estateId,
                    assetId,
                    request.condition().name(),
                    request.assessedOn(),
                    request.notes(),
                    call.getArgument(3),
                    call.getArgument(4),
                    now);
        });
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(post(base)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("GOOD", LocalDate.parse("2026-09-01"), "Fine")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void recordsAnAssessmentWithWhoRecordedItAndWhen() throws Exception {
        createEchoesTheRequest();
        mvc.perform(record(body("NEEDS_ATTENTION", LocalDate.parse("2026-09-20"), "  Seal weeping at the gland.  ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.condition").value("NEEDS_ATTENTION"))
                .andExpect(jsonPath("$.assessedOn").value("2026-09-20"))
                .andExpect(jsonPath("$.notes").value("Seal weeping at the gland."))
                .andExpect(jsonPath("$.recordedByUserId").value("owner"))
                .andExpect(jsonPath("$.recordedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.recordedAt").value("2026-09-28T00:00:00Z"));
    }

    @Test
    void savesTheAssessmentEvenWhenWorkOSCannotNameTheRecorder() throws Exception {
        when(workOS.findDisplayName("owner")).thenReturn(Optional.empty());
        createEchoesTheRequest();
        mvc.perform(record(body("GOOD", LocalDate.parse("2026-09-20"), "Fine")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedByUserId").value("owner"))
                .andExpect(jsonPath("$.recordedByName").value(nullValue()));
    }

    @Test
    void acceptsABackDatedAssessment() throws Exception {
        createEchoesTheRequest();
        mvc.perform(record(body("FAULTY", LocalDate.parse("2020-01-15"), "From the 2020 inspection report.")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.assessedOn").value("2020-01-15"));
    }

    @Test
    void rejectsAnAssessmentDatedInTheFuture() throws Exception {
        // Two days ahead is in the future in every time zone.
        mvc.perform(record(body("GOOD", LocalDate.now().plusDays(2), "Fine")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The assessment date cannot be in the future."));
        verify(repository, never()).create(any(), any(), any(), any(), any());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{\"assessedOn\":\"2026-09-01\",\"notes\":\"Fine\"}",
                "{\"condition\":\"BROKEN\",\"assessedOn\":\"2026-09-01\",\"notes\":\"Fine\"}",
                "{\"condition\":\"GOOD\",\"notes\":\"Fine\"}",
                "{\"condition\":\"GOOD\",\"assessedOn\":\"not-a-date\",\"notes\":\"Fine\"}",
                "{\"condition\":\"GOOD\",\"assessedOn\":\"2026-09-01\",\"notes\":\"   \"}",
                "{\"condition\":\"GOOD\",\"assessedOn\":\"2026-09-01\"}"
            })
    void rejectsMissingOrInvalidDetails(String json) throws Exception {
        mvc.perform(record(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        verify(repository, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void rejectsNotesOverTheLimit() throws Exception {
        mvc.perform(record(body("GOOD", LocalDate.parse("2026-09-01"), "x".repeat(2001))))
                .andExpect(status().isBadRequest());
        verify(repository, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void listsTheHistoryCurrentFirst() throws Exception {
        when(repository.listForAsset(assetId))
                .thenReturn(List.of(
                        assessment("FAULTY", "2026-09-20", "Casey Doe"), assessment("GOOD", "2026-03-01", null)));
        mvc.perform(as("owner", get(base)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].condition").value("FAULTY"))
                .andExpect(jsonPath("$[1].condition").value("GOOD"))
                .andExpect(jsonPath("$[1].recordedByName").value(nullValue()));
    }

    @Test
    void keepsADeactivatedAssetsHistoryButRejectsNewAssessments() throws Exception {
        when(assets.find(assetId, estateId, false)).thenReturn(Optional.of(asset(now)));
        when(assets.find(assetId, estateId, true)).thenReturn(Optional.of(asset(now)));
        when(repository.listForAsset(assetId)).thenReturn(List.of(assessment("GOOD", "2026-03-01", "Casey Doe")));
        mvc.perform(as("owner", get(base)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(record(body("GOOD", LocalDate.parse("2026-09-01"), "Fine"))).andExpect(status().isConflict());
        verify(repository, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void rejectsAssessmentsInAnInactiveEstate() throws Exception {
        when(estates.findOwned(estateId, "owner", true)).thenReturn(Optional.of(estate(now)));
        mvc.perform(record(body("GOOD", LocalDate.parse("2026-09-01"), "Fine"))).andExpect(status().isConflict());
        verify(repository, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    void hidesOtherOwnersEstatesAndUnknownAssets() throws Exception {
        mvc.perform(as("other", get(base))).andExpect(status().isNotFound());
        mvc.perform(as("other", post(base))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("GOOD", LocalDate.parse("2026-09-01"), "Fine")))
                .andExpect(status().isNotFound());
        var unknownAsset = "/estates/" + estateId + "/assets/" + unknownId + "/assessments";
        mvc.perform(as("owner", get(unknownAsset)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Asset not found."));
        verify(repository, never()).create(any(), any(), any(), any(), any());
    }
}
