package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DashboardIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    UUID estate(String owner, String code, boolean inactive) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\", \"deactivatedAt\") values (?, ?, ?, ?, 'Road', '123456', now(), case when ? then now() else null end)",
                id,
                owner,
                code,
                code,
                inactive);
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block', now())",
                UUID.randomUUID(),
                id);
        return id;
    }

    UUID asset(UUID estate, boolean retired) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\", \"deactivatedAt\") select ?, ?, id, ?, 'Pump', 'PUMP', now(), case when ? then now() else null end from \"Location\" where \"estateId\"=? limit 1",
                id,
                estate,
                id.toString(),
                retired,
                estate);
        return id;
    }

    void assessment(UUID estate, UUID asset, UUID id, String condition, String date, String time) {
        db.execute(
                "insert into \"AssetAssessment\" (id, \"estateId\", \"assetId\", condition, \"assessedOn\", notes, \"recordedByUserId\", \"createdAt\") values (?, ?, ?, ?, ?::date, 'Notes', 'owner', ?::timestamptz)",
                id,
                estate,
                asset,
                condition,
                date,
                time);
    }

    void assess(UUID estate, UUID asset, String condition) {
        assessment(estate, asset, UUID.randomUUID(), condition, "2026-09-20", "2026-09-20T00:00:00Z");
    }

    void share(UUID estate, String user) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\") values (?, ?)", estate, user);
    }

    @Test
    void countsAccessibleEstatesButOnlyActiveOwnedAssets() throws Exception {
        var owned = estate("owner", "OWN", false);
        var inactive = estate("owner", "OLD", true);
        var shared = estate("other", "SHARED", false);
        var secret = estate("other", "SECRET", false);
        share(owned, "owner"); // Membership must not double-count ownership.
        share(shared, "owner");
        assess(owned, asset(owned, false), "GOOD");
        assess(owned, asset(owned, false), "NEEDS_ATTENTION");
        assess(owned, asset(owned, false), "FAULTY");
        asset(owned, false);
        assess(owned, asset(owned, true), "FAULTY");
        assess(inactive, asset(inactive, false), "FAULTY");
        assess(shared, asset(shared, false), "FAULTY");
        assess(secret, asset(secret, false), "FAULTY");
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessibleEstateCount").value(3))
                .andExpect(jsonPath("$.activeEstateCount").value(2))
                .andExpect(jsonPath("$.inactiveEstateCount").value(1))
                .andExpect(jsonPath("$.activeOwnedEstateCount").value(1))
                .andExpect(jsonPath("$.totalActiveAssets").value(4))
                .andExpect(jsonPath("$.conditionCounts.good").value(1))
                .andExpect(jsonPath("$.conditionCounts.needsAttention").value(1))
                .andExpect(jsonPath("$.conditionCounts.faulty").value(1))
                .andExpect(jsonPath("$.conditionCounts.unassessed").value(1))
                .andExpect(jsonPath("$.affectedEstateCount").value(1))
                .andExpect(jsonPath("$.estatesNeedingAttention.length()").value(1))
                .andExpect(jsonPath("$.estatesNeedingAttention[0].estateId").value(owned.toString()))
                .andExpect(jsonPath("$.estatesNeedingAttention[0].totalActiveAssets")
                        .value(4));
    }

    @Test
    void usesAssessmentDateThenRecordedTimeThenIdAsTheRegisterDoes() throws Exception {
        var e = estate("owner", "LATEST", false);
        var a = asset(e, false);
        assessment(e, a, UUID.randomUUID(), "FAULTY", "2026-09-01", "2026-10-01T00:00:00Z");
        assessment(
                e,
                a,
                UUID.fromString("00000000-0000-0000-0000-000000000001"),
                "NEEDS_ATTENTION",
                "2026-09-20",
                "2026-09-21T00:00:00Z");
        assessment(
                e,
                a,
                UUID.fromString("00000000-0000-0000-0000-000000000002"),
                "GOOD",
                "2026-09-20",
                "2026-09-22T00:00:00Z");
        assessment(
                e,
                a,
                UUID.fromString("00000000-0000-0000-0000-000000000003"),
                "FAULTY",
                "2026-09-20",
                "2026-09-22T00:00:00Z");
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalActiveAssets").value(1))
                .andExpect(jsonPath("$.conditionCounts.good").value(1))
                .andExpect(jsonPath("$.conditionCounts.faulty").value(0))
                .andExpect(jsonPath("$.affectedEstateCount").value(0))
                .andExpect(jsonPath("$.estatesNeedingAttention").isEmpty());
    }

    @Test
    void ranksAttentionThenFaultyThenCodeAndLimitsRowsWithoutLimitingTotals() throws Exception {
        for (String code : new String[] {"F", "E", "D", "C", "B", "A"}) {
            var e = estate("owner", code, false);
            assess(e, asset(e, false), code.equals("F") ? "NEEDS_ATTENTION" : "FAULTY");
        }
        var priority = estate("owner", "PRIORITY", false);
        assess(priority, asset(priority, false), "NEEDS_ATTENTION");
        assess(priority, asset(priority, false), "NEEDS_ATTENTION");
        var healthy = estate("owner", "HEALTHY", false);
        assess(healthy, asset(healthy, false), "GOOD");
        var unknown = estate("owner", "UNKNOWN", false);
        asset(unknown, false);
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalActiveAssets").value(10))
                .andExpect(jsonPath("$.affectedEstateCount").value(7))
                .andExpect(jsonPath("$.estatesNeedingAttention.length()").value(5))
                .andExpect(jsonPath("$.estatesNeedingAttention[0].estateCode").value("PRIORITY"))
                .andExpect(jsonPath("$.estatesNeedingAttention[1].estateCode").value("A"))
                .andExpect(jsonPath("$.estatesNeedingAttention[4].estateCode").value("D"));
    }

    @Test
    void doesNotGrantAssetVisibilityToAnAdminWithSharedEstateAccess() throws Exception {
        var e = estate("owner", "PRIVATE", false);
        assess(e, asset(e, false), "FAULTY");
        share(e, "admin");
        mvc.perform(get("/dashboard/summary")
                        .with(jwt().jwt(j -> j.subject("admin").claim("role", "admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessibleEstateCount").value(1))
                .andExpect(jsonPath("$.activeOwnedEstateCount").value(0))
                .andExpect(jsonPath("$.totalActiveAssets").value(0))
                .andExpect(jsonPath("$.estatesNeedingAttention").isEmpty());
    }

    @Test
    void returnsZeroCountsForAnAccountWithNoEstates() throws Exception {
        estate("other", "PRIVATE", false);
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("new-user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessibleEstateCount").value(0))
                .andExpect(jsonPath("$.conditionCounts.unassessed").value(0))
                .andExpect(jsonPath("$.estatesNeedingAttention").isEmpty());
    }

    @Test
    void rejectsMissingOrBlankIdentity() throws Exception {
        mvc.perform(get("/dashboard/summary")).andExpect(status().isUnauthorized());
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject(" "))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Sign in to view your dashboard."));
    }

    @Test
    void countsUniqueAcceptedCouncilMembersOnlyInActiveOwnedEstates() throws Exception {
        var a = estate("owner", "A", false);
        var b = estate("owner", "B", false);
        var inactive = estate("owner", "OLD", true);
        var shared = estate("other", "SHARED", false);
        share(a, "member-one");
        share(b, "member-one");
        share(b, "member-two");
        share(a, "owner");
        share(inactive, "inactive-only");
        share(shared, "owner");
        share(shared, "shared-only");
        db.execute(
                "insert into \"EstateInvitation\" (id, \"estateId\", name, email, \"inviterUserId\", status, \"expiresAt\") values (?, ?, '', 'pending@example.com', 'owner', 'IN_APP', now() + interval '1 day')",
                UUID.randomUUID(),
                a);
        asset(a, false);
        asset(a, false); // Joining assets must not multiply members.
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.councilMemberCount").value(2));
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("member-one"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.councilMemberCount").value(0));
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='member-two'", b);
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.councilMemberCount").value(1));
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(j -> j.subject("no-estates"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.councilMemberCount").value(0));
    }
}
