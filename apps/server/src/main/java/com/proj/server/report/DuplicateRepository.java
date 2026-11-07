package com.proj.server.report;

import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Issuereportduplicate.ISSUEREPORTDUPLICATE;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Workorder.WORKORDER;
import static org.jooq.impl.DSL.concatWs;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.inline;
import static org.jooq.impl.DSL.notExists;
import static org.jooq.impl.DSL.selectOne;
import static org.jooq.impl.DSL.when;

import com.proj.server.report.DuplicateDetector.Candidate;
import com.proj.server.report.DuplicateDetector.LocationMatch;
import com.proj.server.report.DuplicateDetector.Match;
import com.proj.server.resident.IssueReportSummaryResponse.ReportLocation;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class DuplicateRepository {
    static final List<String> ACTIVE_STATES = List.of("SUSPECTED", "CONFIRMED");
    static final Summary NONE = new Summary(0, 0, null);

    /** Duplicate information for one report: links pointing at it, and its own active link. */
    public record Summary(int confirmed, int suspected, DuplicateOf duplicateOf) {}

    private final DSLContext db;

    public DuplicateRepository(DSLContext db) {
        this.db = db;
    }

    /**
     * Open, unlinked reports in the estate whose location is the same as, or in the same location group as, the given
     * location. A LEVEL and its common areas form one group; a BLOCK's direct common areas form another.
     */
    public List<Candidate> candidates(UUID estateId, UUID excludedReportId, UUID locationId) {
        var location = db.select(LOCATION.TYPE, LOCATION.PARENTID, LOCATION.PARENTTYPE)
                .from(LOCATION)
                .where(LOCATION.ID.eq(locationId).and(LOCATION.ESTATEID.eq(estateId)))
                .fetchOne();
        if (location == null) return List.of();
        boolean level = "LEVEL".equals(location.value1());
        UUID groupId = level ? locationId : location.value2();
        String groupType = level ? "LEVEL" : location.value3();
        if (groupId == null || groupType == null) return List.of();

        var candidateGroupId = when(LOCATION.TYPE.eq("LEVEL"), LOCATION.ID).otherwise(LOCATION.PARENTID);
        var candidateGroupType =
                when(LOCATION.TYPE.eq("LEVEL"), inline("LEVEL")).otherwise(LOCATION.PARENTTYPE);
        var match = when(ISSUEREPORT.LOCATIONID.eq(locationId), inline(LocationMatch.EXACT.name()))
                .otherwise(inline(LocationMatch.NEARBY.name()));

        return db.select(ISSUEREPORT.ID, ISSUEREPORT.CREATEDAT, match, ISSUEREPORT.TITLE, ISSUEREPORT.DESCRIPTION)
                .from(ISSUEREPORT)
                .join(LOCATION)
                .on(LOCATION.ID.eq(ISSUEREPORT.LOCATIONID).and(LOCATION.ESTATEID.eq(ISSUEREPORT.ESTATEID)))
                .where(ISSUEREPORT.ESTATEID.eq(estateId))
                .and(ISSUEREPORT.ID.ne(excludedReportId))
                .and(candidateGroupId.eq(groupId))
                .and(candidateGroupType.eq(groupType))
                .and(open())
                .and(notExists(selectOne()
                        .from(ISSUEREPORTDUPLICATE)
                        .where(ISSUEREPORTDUPLICATE.REPORTID.eq(ISSUEREPORT.ID))
                        .and(ISSUEREPORTDUPLICATE.STATE.in(ACTIVE_STATES))))
                .fetch(row -> new Candidate(
                        row.value1(), row.value2(), LocationMatch.valueOf(row.value3()), row.value4(), row.value5()));
    }

    public void insertDetected(UUID estateId, UUID reportId, Match match) {
        db.insertInto(ISSUEREPORTDUPLICATE)
                .set(ISSUEREPORTDUPLICATE.REPORTID, reportId)
                .set(ISSUEREPORTDUPLICATE.ESTATEID, estateId)
                .set(ISSUEREPORTDUPLICATE.ORIGINALREPORTID, match.originalReportId())
                .set(ISSUEREPORTDUPLICATE.STATE, "SUSPECTED")
                .set(ISSUEREPORTDUPLICATE.SOURCE, "DETECTED")
                .set(ISSUEREPORTDUPLICATE.LOCATIONMATCH, match.locationMatch().name())
                .set(ISSUEREPORTDUPLICATE.TEXTSIMILARITY, match.textSimilarity())
                .set(ISSUEREPORTDUPLICATE.REPEATCUE, match.repeatCue())
                .execute();
    }

    public Map<UUID, Summary> summaries(UUID estateId, Collection<UUID> reportIds) {
        var result = new HashMap<UUID, Summary>();
        if (reportIds.isEmpty()) return result;
        var confirmed = count().filterWhere(ISSUEREPORTDUPLICATE.STATE.eq(DuplicateState.CONFIRMED.name()));
        var suspected = count().filterWhere(ISSUEREPORTDUPLICATE.STATE.eq(DuplicateState.SUSPECTED.name()));
        db.select(ISSUEREPORTDUPLICATE.ORIGINALREPORTID, confirmed, suspected)
                .from(ISSUEREPORTDUPLICATE)
                .where(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId))
                .and(ISSUEREPORTDUPLICATE.ORIGINALREPORTID.in(reportIds))
                .groupBy(ISSUEREPORTDUPLICATE.ORIGINALREPORTID)
                .forEach(row -> result.put(row.value1(), new Summary(row.value2(), row.value3(), null)));
        var original = ISSUEREPORT.as("original");
        db.select(ISSUEREPORTDUPLICATE.REPORTID, original.ID, original.TITLE, ISSUEREPORTDUPLICATE.STATE)
                .from(ISSUEREPORTDUPLICATE)
                .join(original)
                .on(original.ID
                        .eq(ISSUEREPORTDUPLICATE.ORIGINALREPORTID)
                        .and(original.ESTATEID.eq(ISSUEREPORTDUPLICATE.ESTATEID)))
                .where(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId))
                .and(ISSUEREPORTDUPLICATE.REPORTID.in(reportIds))
                .and(ISSUEREPORTDUPLICATE.STATE.in(ACTIVE_STATES))
                .forEach(row -> {
                    var link = new DuplicateOf(row.value2(), row.value3(), DuplicateState.valueOf(row.value4()));
                    var counts = result.getOrDefault(row.value1(), NONE);
                    result.put(row.value1(), new Summary(counts.confirmed(), counts.suspected(), link));
                });
        return result;
    }

    /** SUSPECTED and CONFIRMED duplicates of an original, newest first. */
    public List<LinkedDuplicate> linked(UUID estateId, UUID originalReportId) {
        var parent = LOCATION.as("parent");
        var grandparent = LOCATION.as("grandparent");
        var label = concatWs(" › ", grandparent.NAME, parent.NAME, LOCATION.NAME);
        return db.select(
                        ISSUEREPORT.ID,
                        ISSUEREPORT.TITLE,
                        ISSUEREPORT.LOCATIONID,
                        label,
                        ISSUEREPORTDUPLICATE.STATE,
                        ISSUEREPORT.CREATEDAT)
                .from(ISSUEREPORTDUPLICATE)
                .join(ISSUEREPORT)
                .on(ISSUEREPORT
                        .ID
                        .eq(ISSUEREPORTDUPLICATE.REPORTID)
                        .and(ISSUEREPORT.ESTATEID.eq(ISSUEREPORTDUPLICATE.ESTATEID)))
                .join(LOCATION)
                .on(LOCATION.ID.eq(ISSUEREPORT.LOCATIONID))
                .leftJoin(parent)
                .on(parent.ID.eq(LOCATION.PARENTID))
                .leftJoin(grandparent)
                .on(grandparent.ID.eq(parent.PARENTID))
                .where(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId))
                .and(ISSUEREPORTDUPLICATE.ORIGINALREPORTID.eq(originalReportId))
                .and(ISSUEREPORTDUPLICATE.STATE.in(ACTIVE_STATES))
                .orderBy(ISSUEREPORT.CREATEDAT.desc(), ISSUEREPORT.ID.desc())
                .fetch(row -> new LinkedDuplicate(
                        row.value1(),
                        row.value2(),
                        new ReportLocation(row.value3(), row.value4()),
                        DuplicateState.valueOf(row.value5()),
                        row.value6()));
    }

    public boolean reportExists(UUID estateId, UUID reportId) {
        return db.fetchExists(ISSUEREPORT, ISSUEREPORT.ID.eq(reportId).and(ISSUEREPORT.ESTATEID.eq(estateId)));
    }

    /** The report's current link state, or null when it has no link. Locks the link row. */
    public DuplicateState lockedState(UUID estateId, UUID reportId) {
        var state = db.select(ISSUEREPORTDUPLICATE.STATE)
                .from(ISSUEREPORTDUPLICATE)
                .where(ISSUEREPORTDUPLICATE.REPORTID.eq(reportId).and(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId)))
                .forUpdate()
                .fetchOne(ISSUEREPORTDUPLICATE.STATE);
        return state == null ? null : DuplicateState.valueOf(state);
    }

    public boolean hasActiveLink(UUID estateId, UUID reportId) {
        return db.fetchExists(
                ISSUEREPORTDUPLICATE,
                ISSUEREPORTDUPLICATE
                        .REPORTID
                        .eq(reportId)
                        .and(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId))
                        .and(ISSUEREPORTDUPLICATE.STATE.in(ACTIVE_STATES)));
    }

    public boolean hasActiveDuplicates(UUID estateId, UUID reportId) {
        return db.fetchExists(
                ISSUEREPORTDUPLICATE,
                ISSUEREPORTDUPLICATE
                        .ORIGINALREPORTID
                        .eq(reportId)
                        .and(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId))
                        .and(ISSUEREPORTDUPLICATE.STATE.in(ACTIVE_STATES)));
    }

    public void decide(UUID estateId, UUID reportId, DuplicateState state, String user) {
        db.update(ISSUEREPORTDUPLICATE)
                .set(ISSUEREPORTDUPLICATE.STATE, state.name())
                .set(ISSUEREPORTDUPLICATE.DECIDEDBYUSERID, user)
                .set(ISSUEREPORTDUPLICATE.DECIDEDAT, currentOffsetDateTime())
                .where(ISSUEREPORTDUPLICATE.REPORTID.eq(reportId).and(ISSUEREPORTDUPLICATE.ESTATEID.eq(estateId)))
                .execute();
    }

    /** Saves a CONFIRMED manual link, replacing a REJECTED one if present. */
    public void linkManually(UUID estateId, UUID reportId, UUID originalReportId, String user) {
        db.insertInto(ISSUEREPORTDUPLICATE)
                .set(ISSUEREPORTDUPLICATE.REPORTID, reportId)
                .set(ISSUEREPORTDUPLICATE.ESTATEID, estateId)
                .set(ISSUEREPORTDUPLICATE.ORIGINALREPORTID, originalReportId)
                .set(ISSUEREPORTDUPLICATE.STATE, DuplicateState.CONFIRMED.name())
                .set(ISSUEREPORTDUPLICATE.SOURCE, "MANUAL")
                .set(ISSUEREPORTDUPLICATE.DECIDEDBYUSERID, user)
                .set(ISSUEREPORTDUPLICATE.DECIDEDAT, currentOffsetDateTime())
                .onConflict(ISSUEREPORTDUPLICATE.REPORTID)
                .doUpdate()
                .set(ISSUEREPORTDUPLICATE.ORIGINALREPORTID, originalReportId)
                .set(ISSUEREPORTDUPLICATE.STATE, DuplicateState.CONFIRMED.name())
                .set(ISSUEREPORTDUPLICATE.SOURCE, "MANUAL")
                .setNull(ISSUEREPORTDUPLICATE.LOCATIONMATCH)
                .setNull(ISSUEREPORTDUPLICATE.TEXTSIMILARITY)
                .setNull(ISSUEREPORTDUPLICATE.REPEATCUE)
                .set(ISSUEREPORTDUPLICATE.DECIDEDBYUSERID, user)
                .set(ISSUEREPORTDUPLICATE.DECIDEDAT, currentOffsetDateTime())
                .execute();
    }

    /** A report is open with no work orders, or while any of its work orders is not CLOSED. */
    private static Condition open() {
        var sourced = WORKORDER.SOURCEREPORTID.eq(ISSUEREPORT.ID).and(WORKORDER.ESTATEID.eq(ISSUEREPORT.ESTATEID));
        return notExists(selectOne().from(WORKORDER).where(sourced))
                .or(exists(selectOne().from(WORKORDER).where(sourced).and(WORKORDER.STATUS.ne("CLOSED"))));
    }
}
