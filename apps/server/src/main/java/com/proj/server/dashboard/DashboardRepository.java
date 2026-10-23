package com.proj.server.dashboard;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.jooq.impl.DSL.countLarge;
import static org.jooq.impl.DSL.countLargeDistinct;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.lateral;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.select;
import static org.jooq.impl.DSL.selectOne;
import static org.jooq.impl.DSL.trueCondition;

import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.springframework.stereotype.Repository;

@Repository
public class DashboardRepository {
    private final DSLContext db;

    public DashboardRepository(DSLContext db) {
        this.db = db;
    }

    /** One statement gives counts from a single Postgres snapshot, including empty estates. */
    public SummaryCounts summary(String user) {
        var ownership = field(ESTATE.OWNERUSERID.eq(user)).as("owned");
        var membership = selectOne()
                .from(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(ESTATE.ID).and(ESTATEUSER.USERID.eq(user)));
        var accessible = name("accessible")
                .as(db.select(ESTATE.ID, ESTATE.NAME, ESTATE.CODE, ESTATE.DEACTIVATEDAT, ownership)
                        .from(ESTATE)
                        .whereNotExists(selectOne()
                                .from(ESTATEUSER)
                                .where(ESTATEUSER
                                        .ESTATEID
                                        .eq(ESTATE.ID)
                                        .and(ESTATEUSER.USERID.eq(user))
                                        .and(ESTATEUSER.ROLE.eq("RESIDENT"))))
                        .and(ESTATE.OWNERUSERID
                                .eq(user)
                                .orExists(membership.and(ESTATEUSER.ROLE.in("MEMBER", "COUNCIL", "MANAGER")))));
        var estateId = accessible.field(ESTATE.ID);
        var estateName = accessible.field(ESTATE.NAME);
        var estateCode = accessible.field(ESTATE.CODE);
        var deactivatedAt = accessible.field(ESTATE.DEACTIVATEDAT);
        var owned = accessible.field(ownership);
        var active = field(deactivatedAt.isNull()).as("active");
        var ownedEstate = accessible.as("owned_estate");
        Field<Long> members = select(countLargeDistinct(ESTATEUSER.USERID))
                .from(ESTATEUSER)
                .join(ownedEstate)
                .on(ownedEstate.field(ESTATE.ID).eq(ESTATEUSER.ESTATEID))
                .where(ownedEstate
                        .field(ownership)
                        .eq(true)
                        .and(ownedEstate.field(ESTATE.DEACTIVATEDAT).isNull())
                        .and(ESTATEUSER.USERID.ne(user))
                        .and(ESTATEUSER.ROLE.in("MEMBER", "COUNCIL")))
                .asField("members");
        var latestAssessment = lateral(select(ASSETASSESSMENT.CONDITION)
                        .from(ASSETASSESSMENT)
                        .where(ASSETASSESSMENT.ASSETID.eq(ASSET.ID))
                        .orderBy(
                                ASSETASSESSMENT.ASSESSEDON.desc(), ASSETASSESSMENT.CREATEDAT.desc(), ASSETASSESSMENT.ID)
                        .limit(1))
                .as("latest_assessment");
        var condition = latestAssessment.field(ASSETASSESSMENT.CONDITION);
        var total = countLarge(ASSET.ID).as("total");
        var good = countLarge(ASSET.ID).filterWhere(condition.eq("GOOD")).as("good");
        var attention = countLarge(ASSET.ID)
                .filterWhere(condition.eq("NEEDS_ATTENTION"))
                .as("attention");
        var faulty = countLarge(ASSET.ID).filterWhere(condition.eq("FAULTY")).as("faulty");
        var unassessed = countLarge(ASSET.ID).filterWhere(condition.isNull()).as("unassessed");
        var rows = db.with(accessible)
                .select(
                        estateId,
                        estateName,
                        estateCode,
                        owned,
                        active,
                        members,
                        total,
                        good,
                        attention,
                        faulty,
                        unassessed)
                .from(accessible)
                .leftJoin(ASSET)
                .on(ASSET.ESTATEID
                        .eq(estateId)
                        .and(owned.eq(true))
                        .and(deactivatedAt.isNull())
                        .and(ASSET.DEACTIVATEDAT.isNull()))
                .leftJoin(latestAssessment)
                .on(trueCondition())
                .groupBy(estateId, estateName, estateCode, owned, deactivatedAt)
                .fetch();
        var estates = rows.map(row -> new EstateCounts(
                row.get(estateId),
                row.get(estateName),
                row.get(estateCode),
                row.get(owned),
                row.get(active),
                row.get(total),
                row.get(good),
                row.get(attention),
                row.get(faulty),
                row.get(unassessed)));
        return new SummaryCounts(estates, rows.isEmpty() ? 0 : rows.getFirst().get(members));
    }

    public record SummaryCounts(List<EstateCounts> estates, long councilMemberCount) {}

    public record EstateCounts(
            UUID id,
            String name,
            String code,
            boolean owned,
            boolean active,
            long total,
            long good,
            long needsAttention,
            long faulty,
            long unassessed) {
        long attentionCount() {
            return needsAttention + faulty;
        }
    }
}
