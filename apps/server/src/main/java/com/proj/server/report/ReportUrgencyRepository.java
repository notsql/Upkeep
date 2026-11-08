package com.proj.server.report;

import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Issuereporturgencyevent.ISSUEREPORTURGENCYEVENT;

import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class ReportUrgencyRepository {
    private final DSLContext db;

    public ReportUrgencyRepository(DSLContext db) {
        this.db = db;
    }

    public record Values(ReportUrgency urgency, boolean isSafety, int version) {}

    public Values values(UUID estate, UUID report) {
        return db.select(ISSUEREPORT.URGENCY, ISSUEREPORT.ISSAFETY, ISSUEREPORT.URGENCYVERSION)
                .from(ISSUEREPORT)
                .where(ISSUEREPORT.ID.eq(report).and(ISSUEREPORT.ESTATEID.eq(estate)))
                .fetchOne(row -> new Values(ReportUrgency.valueOf(row.value1()), row.value2(), row.value3()));
    }

    public ReportUrgencyChange latest(UUID estate, UUID report) {
        var event = ISSUEREPORTURGENCYEVENT;
        return db.selectFrom(event)
                .where(event.ESTATEID.eq(estate).and(event.REPORTID.eq(report)))
                .orderBy(event.VERSION.desc())
                .limit(1)
                .fetchOne(row -> new ReportUrgencyChange(
                        row.getId(),
                        row.getVersion(),
                        ReportUrgency.valueOf(row.getFromurgency()),
                        ReportUrgency.valueOf(row.getTourgency()),
                        row.getFromissafety(),
                        row.getToissafety(),
                        row.getChangedbyname(),
                        row.getChangedat()));
    }

    /** Called under the estate lock and one Spring transaction, so the report and event commit together. */
    public void change(
            UUID estate, UUID report, Values before, ChangeReportUrgencyRequest request, String user, String name) {
        var now = DSL.function(DSL.name("clock_timestamp"), ISSUEREPORT.UPDATEDAT.getDataType());
        int version = before.version() + 1;
        db.update(ISSUEREPORT)
                .set(ISSUEREPORT.URGENCY, request.urgency().name())
                .set(ISSUEREPORT.ISSAFETY, request.isSafety())
                .set(ISSUEREPORT.URGENCYVERSION, version)
                .set(ISSUEREPORT.UPDATEDAT, now)
                .where(ISSUEREPORT.ID.eq(report).and(ISSUEREPORT.ESTATEID.eq(estate)))
                .execute();
        var event = ISSUEREPORTURGENCYEVENT;
        db.insertInto(event)
                .set(event.ID, UUID.randomUUID())
                .set(event.ESTATEID, estate)
                .set(event.REPORTID, report)
                .set(event.VERSION, version)
                .set(event.FROMURGENCY, before.urgency().name())
                .set(event.TOURGENCY, request.urgency().name())
                .set(event.FROMISSAFETY, before.isSafety())
                .set(event.TOISSAFETY, request.isSafety())
                .set(event.CHANGEDBYUSERID, user)
                .set(event.CHANGEDBYNAME, name)
                .set(event.CHANGEDAT, now)
                .execute();
    }
}
