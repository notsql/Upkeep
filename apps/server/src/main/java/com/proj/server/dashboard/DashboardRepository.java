package com.proj.server.dashboard;

import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class DashboardRepository {
    private final DSLContext db;

    public DashboardRepository(DSLContext db) {
        this.db = db;
    }

    /** One statement gives counts from a single Postgres snapshot, including empty estates. */
    public SummaryCounts summary(String user) {
        var rows = db.resultQuery("""
                with accessible as (
                    select e.*, e."ownerUserId"=? owned
                    from "Estate" e
                    where e."ownerUserId"=? or exists (
                        select 1 from "EstateUser" u where u."estateId"=e.id and u."userId"=?
                    )
                )
                select e.id, e.name, e.code, e.owned, e."deactivatedAt" is null active,
                    (select count(distinct m."userId") from "EstateUser" m
                        join accessible o on o.id=m."estateId"
                        where o.owned and o."deactivatedAt" is null and m."userId"<>?) members,
                    count(a.id) total,
                    count(a.id) filter (where c.condition='GOOD') good,
                    count(a.id) filter (where c.condition='NEEDS_ATTENTION') attention,
                    count(a.id) filter (where c.condition='FAULTY') faulty,
                    count(a.id) filter (where c.condition is null) unassessed
                from accessible e
                left join "Asset" a on a."estateId"=e.id and e.owned
                    and e."deactivatedAt" is null and a."deactivatedAt" is null
                left join lateral (
                    select condition from "AssetAssessment" where "assetId"=a.id
                    order by "assessedOn" desc, "createdAt" desc, id limit 1
                ) c on true
                group by e.id, e.name, e.code, e.owned, e."deactivatedAt"
                """, user, user, user, user).fetch();
        var estates = rows.map(row -> new EstateCounts(
                row.get("id", UUID.class),
                row.get("name", String.class),
                row.get("code", String.class),
                row.get("owned", Boolean.class),
                row.get("active", Boolean.class),
                row.get("total", Long.class),
                row.get("good", Long.class),
                row.get("attention", Long.class),
                row.get("faulty", Long.class),
                row.get("unassessed", Long.class)));
        return new SummaryCounts(estates, rows.isEmpty() ? 0 : rows.getFirst().get("members", Long.class));
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
