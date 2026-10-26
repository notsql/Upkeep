package com.proj.server;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.resident.ResidentImageStore;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** HTTP and database behavior for two manually assigned residents. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ResidentReportsIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    ResidentImageStore imageStore;

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder request, String userId) {
        return request.with(jwt().jwt(token -> token.subject(userId).claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user")));
    }

    private UUID estate(String code, boolean inactive) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\", \"deactivatedAt\") values (?, 'manager', ?, ?, 'Road', '123456', now(), case when ? then now() else null end)",
                id,
                code + " Estate",
                code,
                inactive);
        return id;
    }

    private UUID location(UUID estateId, String type, UUID parentId, String parentType, boolean inactive) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, \"parentId\", \"parentType\", name, \"sortOrder\", \"updatedAt\", \"deactivatedAt\") values (?, ?, ?, ?, ?, ?, ?, now(), case when ? then now() else null end)",
                id,
                estateId,
                type,
                parentId,
                parentType,
                type + " " + id,
                type.equals("LEVEL") ? 1 : null,
                inactive);
        return id;
    }

    private void assign(String userId, UUID estateId) {
        db.execute(
                "insert into \"EstateUser\" (\"userId\", \"estateId\", role) values (?, ?, 'RESIDENT')",
                userId,
                estateId);
    }

    private UUID report(String userId, UUID estateId, UUID locationId, String description) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReport\" (id, \"submittedByUserId\", \"estateId\", \"locationId\", title, description, status, \"createdAt\", \"updatedAt\") values (?, ?, ?, ?, 'Fault title', ?, 'SUBMITTED', now(), now())",
                id,
                userId,
                estateId,
                locationId,
                description);
        return id;
    }

    private MockMultipartHttpServletRequestBuilder submission(String userId, UUID locationId, String description) {
        var request = multipart("/resident/reports");
        var selectedEstate = db.fetchValue(
                "select \"estateId\" from \"EstateUser\" where \"userId\"=? and role='RESIDENT' limit 1", userId);
        if (selectedEstate == null)
            selectedEstate = db.fetchValue("select \"estateId\" from \"Location\" where id=?", locationId);
        request.param("estateId", selectedEstate == null ? UUID.randomUUID().toString() : selectedEstate.toString());
        request.param("title", "Fault title");
        request.param("locationId", locationId.toString());
        request.param("description", description);
        request.with(jwt().jwt(token -> token.subject(userId).claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user")));
        return request;
    }

    private UUID selectedEstateId(String user) {
        var selected = db.fetchValue(
                "select \"estateId\" from \"EstateUser\" where \"userId\"=? and role='RESIDENT' limit 1", user);
        return selected == null ? UUID.randomUUID() : (UUID) selected;
    }

    @Test
    void rejectsMissingBlankAndOverlongTitlesBeforeUploadingImagesOrCreatingReports() throws Exception {
        var e = estate("TITLE-VALIDATE", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "png", bytes);
        for (var title : new String[] {null, "", "   ", "x".repeat(51)}) {
            var request = multipart("/resident/reports")
                    .param("description", "Leaking pipe")
                    .param("locationId", level.toString())
                    .param("estateId", e.toString())
                    .file(new MockMultipartFile("images", "fault.png", "image/png", bytes.toByteArray()));
            if (title != null) request.param("title", title);
            mvc.perform(request.with(jwt().jwt(token -> token.subject("resident-a"))
                            .authorities(new SimpleGrantedAuthority("ROLE_user"))))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReport\"", Long.class));
        verifyNoInteractions(imageStore);
    }

    @Test
    void trimsAndPersistsTheTitleInCreateHistoryAndDetailIncludingTheLengthBoundary() throws Exception {
        var e = estate("TITLE-SAVE", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        for (var title : new String[] {"Leaking pipe", "x".repeat(50)}) {
            var response = mvc.perform(multipart("/resident/reports")
                            .param("title", "  " + title + "  ")
                            .param("description", "Water pooling near the lift")
                            .param("locationId", level.toString())
                            .param("estateId", e.toString())
                            .with(jwt().jwt(token -> token.subject("resident-a"))
                                    .authorities(new SimpleGrantedAuthority("ROLE_user"))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.title").value(title))
                    .andExpect(jsonPath("$.description").value("Water pooling near the lift"))
                    .andReturn();
            String id = com.jayway.jsonpath.JsonPath.read(response.getResponse().getContentAsString(), "$.id");
            assertEquals(title, db.fetchValue("select title from \"IssueReport\" where id=?", UUID.fromString(id)));
            mvc.perform(asUser(get("/resident/reports/" + id), "resident-a"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value(title));
            mvc.perform(asUser(get("/resident/reports"), "resident-a"))
                    .andExpect(status().isOk())
                    .andExpect(
                            jsonPath("$.items[?(@.id == '" + id + "')].title").value(hasItem(title)));
        }
    }

    @Test
    void preservesHistoricalTitlesLongerThanTheNewCreationLimit() throws Exception {
        var e = estate("OLD-TITLE", false);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var reportId = report("resident-a", e, level, "Original description");
        var title = "x".repeat(150);
        db.execute("update \"IssueReport\" set title=? where id=?", title, reportId);

        mvc.perform(asUser(get("/resident/reports/" + reportId), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value(title));
        mvc.perform(asUser(get("/resident/reports"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value(title));
    }

    @Test
    void showsOnlyTheCurrentAssignedEstateAndItsActiveLocations() throws Exception {
        var assignedEstate = estate("ASSIGNED", false);
        var otherEstate = estate("OTHER", false);
        assign("resident-a", assignedEstate);
        var block = location(assignedEstate, "BLOCK", null, null, false);
        var level = location(assignedEstate, "LEVEL", block, "BLOCK", false);
        var inactive = location(assignedEstate, "COMMON_AREA", block, "BLOCK", true);
        var otherBlock = location(otherEstate, "BLOCK", null, null, false);

        mvc.perform(asUser(get("/resident/context"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].id").value(assignedEstate.toString()))
                .andExpect(jsonPath("$.estates[0].name").value("ASSIGNED Estate"))
                .andExpect(jsonPath("$.canSubmit").value(true));
        mvc.perform(asUser(
                        get("/resident/locations")
                                .param(
                                        "estateId",
                                        selectedEstateId("resident-a").toString()),
                        "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + block + "')].type").value(hasItem("BLOCK")))
                .andExpect(jsonPath("$[?(@.id == '" + level + "')].parentId").value(hasItem(block.toString())))
                .andExpect(jsonPath("$[?(@.id == '" + inactive + "')]").isEmpty())
                .andExpect(jsonPath("$[?(@.id == '" + otherBlock + "')]").isEmpty());
    }

    @Test
    void unassignedUserCanReadAnEmptyContextButCannotReadLocationsOrSubmit() throws Exception {
        var e = estate("UNASSIGNED", false);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        mvc.perform(asUser(get("/resident/context"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates").isEmpty())
                .andExpect(jsonPath("$.canSubmit").value(false));
        mvc.perform(asUser(
                        get("/resident/locations")
                                .param(
                                        "estateId",
                                        selectedEstateId("resident-a").toString()),
                        "resident-a"))
                .andExpect(status().isForbidden());
        mvc.perform(submission("resident-a", level, "Leaking pipe")).andExpect(status().isForbidden());
    }

    @Test
    void createsAReportForTheJwtSubjectAndAssignmentWithoutClientControlledIdentity() throws Exception {
        var e = estate("CREATE", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);

        var response = mvc.perform(submission("resident-a", level, "Leaking pipe")
                        .param("submittedByUserId", "attacker")
                        .param("status", "RESOLVED"))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.description").value("Leaking pipe"))
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.location.id").value(level.toString()))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andReturn();

        var id = UUID.fromString(
                com.jayway.jsonpath.JsonPath.read(response.getResponse().getContentAsString(), "$.id"));
        assertEquals("resident-a", db.fetchValue("select \"submittedByUserId\" from \"IssueReport\" where id=?", id));
        assertEquals(e, db.fetchValue("select \"estateId\" from \"IssueReport\" where id=?", id));
        assertNotNull(db.fetchValue("select \"createdAt\" from \"IssueReport\" where id=?", id));
    }

    @Test
    void rejectsMissingBlockOnlyInactiveAndCrossEstateLocationsAndInvalidText() throws Exception {
        var assigned = estate("VALIDATE", false);
        var other = estate("CROSS", false);
        assign("resident-a", assigned);
        var block = location(assigned, "BLOCK", null, null, false);
        var inactive = location(assigned, "LEVEL", block, "BLOCK", true);
        var otherBlock = location(other, "BLOCK", null, null, false);
        var otherLevel = location(other, "LEVEL", otherBlock, "BLOCK", false);
        var validLevel = location(assigned, "LEVEL", block, "BLOCK", false);

        for (var locationId : new UUID[] {block, inactive, otherLevel, UUID.randomUUID()}) {
            mvc.perform(submission("resident-a", locationId, "Leaking pipe")).andExpect(status().isBadRequest());
        }
        mvc.perform(submission("resident-a", validLevel, "   ")).andExpect(status().isBadRequest());
        mvc.perform(submission("resident-a", validLevel, "x".repeat(2501))).andExpect(status().isBadRequest());
        var missingLocation = multipart("/resident/reports");
        missingLocation.param("title", "Fault title");
        missingLocation.param("description", "Leaking pipe");
        missingLocation.with(
                jwt().jwt(token -> token.subject("resident-a")).authorities(new SimpleGrantedAuthority("ROLE_user")));
        mvc.perform(missingLocation).andExpect(status().isBadRequest());
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReport\"", Long.class));
    }

    @Test
    void ownershipHidesReportsFromResidentsInTheSameOrDifferentEstate() throws Exception {
        var shared = estate("SHARED", false);
        var separate = estate("SEPARATE", false);
        assign("resident-a", shared);
        assign("resident-b", shared);
        assign("resident-c", separate);
        var block = location(shared, "BLOCK", null, null, false);
        var level = location(shared, "LEVEL", block, "BLOCK", false);
        var secret = report("resident-a", shared, level, "Private fault details");

        for (var otherUser : new String[] {"resident-b", "resident-c"}) {
            mvc.perform(asUser(get("/resident/reports/" + secret), otherUser)).andExpect(status().isNotFound());
            mvc.perform(asUser(get("/resident/reports"), otherUser))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items").isEmpty());
        }
        mvc.perform(asUser(get("/resident/reports/" + UUID.randomUUID()), "resident-a"))
                .andExpect(status().isNotFound());
        mvc.perform(asUser(get("/resident/reports/" + secret), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Private fault details"));
    }

    @Test
    void historicalReportsRemainReadableAfterMembershipDeletion() throws Exception {
        var e = estate("HISTORY", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var oldReport = report("resident-a", e, level, "Earlier report");
        db.execute("delete from \"EstateUser\" where \"userId\"='resident-a' and role='RESIDENT'");

        assertEquals(
                0L, db.fetchValue("select count(*) from \"EstateUser\" where \"userId\"='resident-a'", Long.class));
        mvc.perform(asUser(get("/resident/context"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates").isEmpty())
                .andExpect(jsonPath("$.canSubmit").value(false));

        mvc.perform(asUser(get("/resident/reports/" + oldReport), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Earlier report"));
        mvc.perform(asUser(get("/resident/reports"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(oldReport.toString()));
        mvc.perform(submission("resident-a", level, "New report")).andExpect(status().isForbidden());
    }

    @Test
    void historicalReportsRemainReadableAfterMovingToAnotherEstate() throws Exception {
        var oldEstate = estate("OLDHOME", false);
        var newEstate = estate("NEWHOME", false);
        assign("resident-a", oldEstate);
        var oldBlock = location(oldEstate, "BLOCK", null, null, false);
        var oldLevel = location(oldEstate, "LEVEL", oldBlock, "BLOCK", false);
        var historical = report("resident-a", oldEstate, oldLevel, "Old home fault");
        db.execute("delete from \"EstateUser\" where \"userId\"='resident-a' and role='RESIDENT'");
        assign("resident-a", newEstate);

        mvc.perform(asUser(get("/resident/context"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].id").value(newEstate.toString()));
        mvc.perform(asUser(get("/resident/reports/" + historical), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Old home fault"));
        mvc.perform(submission("resident-a", oldLevel, "New report at old home"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validatesPaginationParametersAndReturnsOnlyTheFirstRequestedPage() throws Exception {
        var e = estate("PAGES", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var older = report("resident-a", e, level, "First");
        var newer = report("resident-a", e, level, "Second");
        db.execute("update \"IssueReport\" set \"createdAt\"=now()-interval '2 days' where id=?", older);
        db.execute("update \"IssueReport\" set \"createdAt\"=now()-interval '1 day' where id=?", newer);

        var firstPage = mvc.perform(asUser(get("/resident/reports?limit=1"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(newer.toString()))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty())
                .andReturn();
        var cursor = com.jayway.jsonpath.JsonPath.<String>read(
                firstPage.getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(asUser(get("/resident/reports").param("limit", "1").param("cursor", cursor), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(older.toString()))
                .andExpect(jsonPath("$.nextCursor").value((Object) null));
        for (var query : new String[] {"limit=0", "limit=51", "cursor=not-a-cursor"}) {
            mvc.perform(asUser(get("/resident/reports?" + query), "resident-a")).andExpect(status().isBadRequest());
        }
    }

    @Test
    void filtersOwnHistoryByEstateBeforePaginationAndRetainsFormerResidentHistory() throws Exception {
        var firstEstate = estate("FILTER-A", false);
        var secondEstate = estate("FILTER-B", false);
        assign("resident-a", firstEstate);
        var firstBlock = location(firstEstate, "BLOCK", null, null, false);
        var firstLevel = location(firstEstate, "LEVEL", firstBlock, "BLOCK", false);
        var secondBlock = location(secondEstate, "BLOCK", null, null, false);
        var secondLevel = location(secondEstate, "LEVEL", secondBlock, "BLOCK", false);
        var older = report("resident-a", firstEstate, firstLevel, "Older first-estate report");
        var newer = report("resident-a", firstEstate, firstLevel, "Newer first-estate report");
        var otherEstate = report("resident-a", secondEstate, secondLevel, "Second-estate report");
        report("resident-b", firstEstate, firstLevel, "Another resident's private report");
        db.execute("update \"IssueReport\" set \"createdAt\"=now()-interval '3 days' where id=?", older);
        db.execute("update \"IssueReport\" set \"createdAt\"=now()-interval '2 days' where id=?", newer);
        db.execute("update \"IssueReport\" set \"createdAt\"=now()-interval '1 day' where id=?", otherEstate);
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='resident-a'", firstEstate);
        var first = mvc.perform(asUser(
                        get("/resident/reports")
                                .param("estateId", firstEstate.toString())
                                .param("limit", "1"),
                        "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(newer.toString()))
                .andReturn();
        String cursor = com.jayway.jsonpath.JsonPath.read(first.getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(asUser(
                        get("/resident/reports")
                                .param("estateId", firstEstate.toString())
                                .param("limit", "1")
                                .param("cursor", cursor),
                        "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(older.toString()))
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        mvc.perform(asUser(get("/resident/reports"), "resident-a"))
                .andExpect(jsonPath("$.items.length()").value(3));
        mvc.perform(asUser(
                        get("/resident/reports")
                                .param("estateId", UUID.randomUUID().toString()),
                        "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void reportCursorsCannotBeReusedForAnotherEstateOrTheUnfilteredList() throws Exception {
        var firstEstate = estate("CURSOR-A", false);
        var secondEstate = estate("CURSOR-B", false);
        var block = location(firstEstate, "BLOCK", null, null, false);
        var level = location(firstEstate, "LEVEL", block, "BLOCK", false);
        report("resident-a", firstEstate, level, "First report");
        report("resident-a", firstEstate, level, "Second report");
        var response = mvc.perform(asUser(
                        get("/resident/reports")
                                .param("estateId", firstEstate.toString())
                                .param("limit", "1"),
                        "resident-a"))
                .andExpect(status().isOk())
                .andReturn();
        String cursor = com.jayway.jsonpath.JsonPath.read(response.getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(asUser(
                        get("/resident/reports")
                                .param("estateId", secondEstate.toString())
                                .param("cursor", cursor),
                        "resident-a"))
                .andExpect(status().isBadRequest());
        mvc.perform(asUser(get("/resident/reports").param("cursor", cursor), "resident-a"))
                .andExpect(status().isBadRequest());
        var all = mvc.perform(asUser(get("/resident/reports").param("limit", "1"), "resident-a"))
                .andExpect(status().isOk())
                .andReturn();
        String allCursor = com.jayway.jsonpath.JsonPath.read(all.getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(asUser(
                        get("/resident/reports")
                                .param("estateId", firstEstate.toString())
                                .param("cursor", allCursor),
                        "resident-a"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMalformedEstateFiltersWithoutRequiringCurrentMembershipForOwnedHistory() throws Exception {
        mvc.perform(asUser(get("/resident/reports").param("estateId", "not-a-uuid"), "resident-a"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsTooManyUnsupportedMalformedAndOversizedImages() throws Exception {
        var e = estate("IMAGES", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var png = new byte[] {(byte) 0x89, 'P', 'N', 'G'};

        mvc.perform(submission("resident-a", level, "Leaking pipe")
                        .file(new MockMultipartFile("images", "fault.heic", "image/heic", png)))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(submission("resident-a", level, "Leaking pipe")
                        .file(new MockMultipartFile("images", "fault.png", "image/png", png)))
                .andExpect(status().isBadRequest());
        var tooLarge = new byte[5 * 1024 * 1024 + 1];
        mvc.perform(submission("resident-a", level, "Leaking pipe")
                        .file(new MockMultipartFile("images", "fault.png", "image/png", tooLarge)))
                .andExpect(status().isPayloadTooLarge());
        var fourImages = submission("resident-a", level, "Leaking pipe");
        for (var i = 0; i < 4; i++) {
            fourImages.file(new MockMultipartFile("images", "fault-" + i + ".png", "image/png", png));
        }
        mvc.perform(fourImages).andExpect(status().isBadRequest());
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReport\"", Long.class));
    }

    @Test
    void doesNotRevealAnImageBelongingToAnotherResidentsReport() throws Exception {
        var e = estate("PRIVATE", false);
        assign("resident-a", e);
        assign("resident-b", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var ownedReport = report("resident-a", e, level, "Private image");
        var imageId = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReportImage\" (id, \"reportId\", \"storageKey\", \"contentType\", \"sizeBytes\") values (?, ?, 'private/secret-key', 'image/png', 4)",
                imageId,
                ownedReport);

        mvc.perform(asUser(get("/resident/reports/" + ownedReport + "/images/" + imageId), "resident-b"))
                .andExpect(status().isNotFound());
        mvc.perform(asUser(get("/resident/reports/" + ownedReport + "/images/" + UUID.randomUUID()), "resident-a"))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsImagesBeyondTheMaximumDecodedDimensions() throws Exception {
        var e = estate("PIXELS", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        for (var dimensions : new int[][] {{4033, 1}, {1, 3025}}) {
            var bytes = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(dimensions[0], dimensions[1], BufferedImage.TYPE_INT_RGB), "png", bytes);
            mvc.perform(submission("resident-a", level, "Leaking pipe")
                            .file(new MockMultipartFile("images", "fault.png", "image/png", bytes.toByteArray())))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReport\"", Long.class));
    }

    @Test
    void aWorkosResidentClaimCannotSubstituteForADatabaseMembership() throws Exception {
        var e = estate("CLAIM", false);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        for (var role : new String[] {"resident", "admin", "user"}) {
            var request = multipart("/resident/reports")
                    .param("title", "Fault title")
                    .param("description", "Not assigned")
                    .param("locationId", level.toString())
                    .param("estateId", e.toString());
            request.with(jwt().jwt(token -> token.subject("unassigned").claim("role", role))
                    .authorities(new SimpleGrantedAuthority("ROLE_" + role)));
            mvc.perform(request).andExpect(status().isForbidden());
        }
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReport\"", Long.class));
    }

    @Test
    void anInactiveResidentEstateKeepsContextButBlocksNewReports() throws Exception {
        var e = estate("INACTIVE", true);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        mvc.perform(asUser(get("/resident/context"), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates").isEmpty())
                .andExpect(jsonPath("$.canSubmit").value(false));
        mvc.perform(asUser(get("/resident/locations").param("estateId", e.toString()), "resident-a"))
                .andExpect(status().isForbidden());
        mvc.perform(submission("resident-a", level, "Inactive estate")).andExpect(status().isForbidden());
    }

    @Test
    void sameTokenReflectsAssignmentAndDeletionWithoutChangingTheWorkosRole() throws Exception {
        var e = estate("TOKEN", false);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var token = jwt().jwt(value -> value.subject("resident-a").claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));

        mvc.perform(get("/resident/context").with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmit").value(false));
        assign("resident-a", e);
        mvc.perform(get("/resident/context").with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmit").value(true));
        mvc.perform(multipart("/resident/reports")
                        .param("title", "Fault title")
                        .param("description", "Assigned now")
                        .param("locationId", level.toString())
                        .param("estateId", e.toString())
                        .with(token))
                .andExpect(status().isCreated());
        db.execute("delete from \"EstateUser\" where \"userId\"='resident-a' and role='RESIDENT'");
        mvc.perform(get("/resident/context").with(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canSubmit").value(false));
        mvc.perform(multipart("/resident/reports")
                        .param("title", "Fault title")
                        .param("description", "Removed now")
                        .param("locationId", level.toString())
                        .param("estateId", e.toString())
                        .with(token))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownPrivateImagesRemainReadableAfterDeletingTheResidentMembership() throws Exception {
        var e = estate("IMAGEHISTORY", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var reportId = report("resident-a", e, level, "Earlier photographed fault");
        var imageId = UUID.randomUUID();
        var bytes = new byte[] {1, 2, 3};
        db.execute(
                "insert into \"IssueReportImage\" (id, \"reportId\", \"storageKey\", \"contentType\", \"sizeBytes\") values (?, ?, 'private/history-image', 'image/png', 3)",
                imageId,
                reportId);
        when(imageStore.read("private/history-image")).thenReturn(bytes);
        db.execute("delete from \"EstateUser\" where \"userId\"='resident-a'");

        var response = mvc.perform(asUser(get("/resident/reports/" + reportId + "/images/" + imageId), "resident-a"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andReturn();
        assertArrayEquals(bytes, response.getResponse().getContentAsByteArray());
        mvc.perform(asUser(get("/resident/reports/" + reportId + "/images/" + imageId), "resident-b"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletionDuringImageUploadAbortsTheReportAndRemovesStagedObjects() throws Exception {
        var e = estate("UPLOADREVOKE", false);
        assign("resident-a", e);
        var block = location(e, "BLOCK", null, null, false);
        var level = location(e, "LEVEL", block, "BLOCK", false);
        var objects = new HashSet<String>();
        when(imageStore.upload(any(), any(), any())).thenAnswer(call -> {
            objects.add("staged/image");
            db.execute("delete from \"EstateUser\" where \"userId\"='resident-a' and role='RESIDENT'");
            return "staged/image";
        });
        doAnswer(call -> {
                    objects.remove(call.getArgument(0, String.class));
                    return null;
                })
                .when(imageStore)
                .deleteQuietly(any());
        var png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "png", png);

        mvc.perform(submission("resident-a", level, "Assignment removed during upload")
                        .file(new MockMultipartFile("images", "fault.png", "image/png", png.toByteArray())))
                .andExpect(status().isForbidden());
        assertEquals(
                0L, db.fetchValue("select count(*) from \"EstateUser\" where \"userId\"='resident-a'", Long.class));
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReport\"", Long.class));
        assertEquals(0L, db.fetchValue("select count(*) from \"IssueReportImage\"", Long.class));
        assertEquals(java.util.Set.of(), objects);
    }
}
