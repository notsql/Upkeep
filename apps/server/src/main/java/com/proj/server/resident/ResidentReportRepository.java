package com.proj.server.resident;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Issuereportimage.ISSUEREPORTIMAGE;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Reportrouting.REPORTROUTING;
import static org.jooq.impl.DSL.concatWs;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.row;
import static org.jooq.impl.DSL.table;
import static org.jooq.impl.DSL.when;

import com.proj.server.db.tables.Location;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.SelectJoinStep;
import org.springframework.stereotype.Repository;

@Repository
public class ResidentReportRepository {
    private static final Location PARENT = LOCATION.as("parent");
    private static final Location GRANDPARENT = LOCATION.as("grandparent");
    private static final Field<String> LOCATION_LABEL = concatWs(" › ", GRANDPARENT.NAME, PARENT.NAME, LOCATION.NAME);

    private final DSLContext db;

    public ResidentReportRepository(DSLContext db) {
        this.db = db;
    }

    public List<ResidentContextResponse.EstateLabel> activeAssignments(String userId) {
        return db.select(ESTATE.ID, ESTATE.NAME)
                .from(ESTATEUSER)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ESTATEUSER.ESTATEID))
                .where(ESTATEUSER
                        .USERID
                        .eq(userId)
                        .and(ESTATEUSER.ROLE.eq("RESIDENT"))
                        .and(ESTATE.DEACTIVATEDAT.isNull()))
                .orderBy(ESTATE.NAME, ESTATE.ID)
                .fetch(row -> new ResidentContextResponse.EstateLabel(row.value1(), row.value2()));
    }

    public Optional<ResidentContextResponse.EstateLabel> activeAssignment(String userId, UUID estateId, boolean lock) {
        if (lock)
            db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId)).forUpdate().fetch();
        var query = db.select(ESTATE.ID, ESTATE.NAME)
                .from(ESTATEUSER)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ESTATEUSER.ESTATEID))
                .where(ESTATEUSER
                        .USERID
                        .eq(userId)
                        .and(ESTATEUSER.ESTATEID.eq(estateId))
                        .and(ESTATEUSER.ROLE.eq("RESIDENT"))
                        .and(ESTATE.DEACTIVATEDAT.isNull()));
        return (lock ? query.forUpdate().of(ESTATEUSER).fetchOptional() : query.fetchOptional())
                .map(row -> new ResidentContextResponse.EstateLabel(row.value1(), row.value2()));
    }

    public boolean hasResidentMembership(String userId) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.USERID.eq(userId).and(ESTATEUSER.ROLE.eq("RESIDENT")));
    }

    public List<ResidentLocationResponse> activeLocations(UUID estateId) {
        return db.select(LOCATION.ID, LOCATION.TYPE, LOCATION.NAME, LOCATION.PARENTID, LOCATION.SORTORDER)
                .from(LOCATION)
                .leftJoin(PARENT)
                .on(PARENT.ID.eq(LOCATION.PARENTID))
                .leftJoin(GRANDPARENT)
                .on(GRANDPARENT.ID.eq(PARENT.PARENTID))
                .where(LOCATION.ESTATEID
                        .eq(estateId)
                        .and(LOCATION.DEACTIVATEDAT.isNull())
                        .and(PARENT.ID.isNull().or(PARENT.DEACTIVATEDAT.isNull()))
                        .and(GRANDPARENT.ID.isNull().or(GRANDPARENT.DEACTIVATEDAT.isNull())))
                .orderBy(LOCATION.TYPE, LOCATION.SORTORDER.asc().nullsLast(), LOCATION.NAME, LOCATION.ID)
                .fetch()
                .map(row -> new ResidentLocationResponse(
                        row.value1(), row.value2(), row.value3(), row.value4(), row.value5()));
    }

    public boolean activeReportLocation(UUID estateId, UUID locationId) {
        return db.fetchExists(db.selectOne()
                .from(LOCATION)
                .leftJoin(PARENT)
                .on(PARENT.ID.eq(LOCATION.PARENTID))
                .leftJoin(GRANDPARENT)
                .on(GRANDPARENT.ID.eq(PARENT.PARENTID))
                .where(LOCATION.ID
                        .eq(locationId)
                        .and(LOCATION.ESTATEID.eq(estateId))
                        .and(LOCATION.TYPE.in("LEVEL", "COMMON_AREA"))
                        .and(LOCATION.DEACTIVATEDAT.isNull())
                        .and(PARENT.DEACTIVATEDAT.isNull())
                        .and(GRANDPARENT.ID.isNull().or(GRANDPARENT.DEACTIVATEDAT.isNull()))));
    }

    public void create(UUID id, String userId, UUID estateId, UUID locationId, String title, String description) {
        db.insertInto(ISSUEREPORT)
                .set(ISSUEREPORT.ID, id)
                .set(ISSUEREPORT.SUBMITTEDBYUSERID, userId)
                .set(ISSUEREPORT.ESTATEID, estateId)
                .set(ISSUEREPORT.LOCATIONID, locationId)
                .set(ISSUEREPORT.TITLE, title)
                .set(ISSUEREPORT.DESCRIPTION, description)
                .set(ISSUEREPORT.STATUS, "SUBMITTED")
                .set(ISSUEREPORT.CREATEDAT, currentOffsetDateTime())
                .set(ISSUEREPORT.UPDATEDAT, currentOffsetDateTime())
                .execute();
    }

    public void addImage(UUID id, UUID reportId, String storageKey, String contentType, int sizeBytes) {
        db.insertInto(ISSUEREPORTIMAGE)
                .set(ISSUEREPORTIMAGE.ID, id)
                .set(ISSUEREPORTIMAGE.REPORTID, reportId)
                .set(ISSUEREPORTIMAGE.STORAGEKEY, storageKey)
                .set(ISSUEREPORTIMAGE.CONTENTTYPE, contentType)
                .set(ISSUEREPORTIMAGE.SIZEBYTES, sizeBytes)
                .execute();
    }

    public Optional<IssueReportDetailResponse> detail(String userId, UUID reportId) {
        return detail(reportSelect()
                .where(ISSUEREPORT.ID.eq(reportId).and(ISSUEREPORT.SUBMITTEDBYUSERID.eq(userId)))
                .fetchOne());
    }

    public Optional<IssueReportDetailResponse> estateDetail(UUID estateId, UUID reportId) {
        return detail(reportSelect()
                .where(ISSUEREPORT.ID.eq(reportId).and(ISSUEREPORT.ESTATEID.eq(estateId)))
                .fetchOne());
    }

    private Optional<IssueReportDetailResponse> detail(Record row) {
        if (row == null) {
            return Optional.empty();
        }
        var images = db.select(ISSUEREPORTIMAGE.ID, ISSUEREPORTIMAGE.CONTENTTYPE)
                .from(ISSUEREPORTIMAGE)
                .where(ISSUEREPORTIMAGE.REPORTID.eq(row.get(ISSUEREPORT.ID)))
                .orderBy(ISSUEREPORTIMAGE.CREATEDAT, ISSUEREPORTIMAGE.ID)
                .fetch()
                .map(image -> new IssueReportDetailResponse.ReportImage(image.value1(), image.value2()));
        var summary = summary(row);
        return Optional.of(new IssueReportDetailResponse(
                summary.id(),
                summary.title(),
                summary.description(),
                summary.estateName(),
                summary.location(),
                summary.status(),
                summary.createdAt(),
                summary.updatedAt(),
                images));
    }

    public List<IssueReportSummaryResponse> list(
            String userId, UUID estateId, OffsetDateTime beforeTime, UUID beforeId, int limit) {
        var condition = ISSUEREPORT.SUBMITTEDBYUSERID.eq(userId);
        if (estateId != null) {
            condition = condition.and(ISSUEREPORT.ESTATEID.eq(estateId));
        }
        if (beforeTime != null) {
            condition = condition.and(row(ISSUEREPORT.CREATEDAT, ISSUEREPORT.ID).lt(beforeTime, beforeId));
        }
        return reportSelect()
                .where(condition)
                .orderBy(ISSUEREPORT.CREATEDAT.desc(), ISSUEREPORT.ID.desc())
                .limit(limit)
                .fetch()
                .map(ResidentReportRepository::summary);
    }

    public Optional<StoredImage> image(String userId, UUID reportId, UUID imageId) {
        return db.select(ISSUEREPORTIMAGE.STORAGEKEY, ISSUEREPORTIMAGE.CONTENTTYPE)
                .from(ISSUEREPORTIMAGE)
                .join(ISSUEREPORT)
                .on(ISSUEREPORT.ID.eq(ISSUEREPORTIMAGE.REPORTID))
                .where(ISSUEREPORT
                        .ID
                        .eq(reportId)
                        .and(ISSUEREPORT.SUBMITTEDBYUSERID.eq(userId))
                        .and(ISSUEREPORTIMAGE.ID.eq(imageId)))
                .fetchOptional()
                .map(record -> new StoredImage(record.value1(), record.value2()));
    }

    public List<IssueReportSummaryResponse> estateList(
            UUID estateId,
            UUID locationId,
            UUID blockId,
            Integer minLevelPosition,
            Integer maxLevelPosition,
            String routingState,
            OffsetDateTime beforeTime,
            UUID beforeId,
            int limit) {
        var condition = ISSUEREPORT.ESTATEID.eq(estateId);
        if (routingState != null) {
            condition = condition.and(ISSUEREPORT.ID.in(
                    db.select(REPORTROUTING.REPORTID).from(REPORTROUTING).where(REPORTROUTING.STATE.eq(routingState))));
        }
        if (locationId != null) {
            var child = LOCATION.as("child");
            var subtreeId = field(name("subtree", "id"), UUID.class);
            var subtree = name("subtree")
                    .fields("id")
                    .as(db.select(LOCATION.ID)
                            .from(LOCATION)
                            .where(LOCATION.ID.eq(locationId).and(LOCATION.ESTATEID.eq(estateId)))
                            .unionAll(db.select(child.ID)
                                    .from(child)
                                    .join(table(name("subtree")))
                                    .on(child.PARENTID.eq(subtreeId))
                                    .where(child.ESTATEID.eq(estateId))));
            condition = condition.and(ISSUEREPORT.LOCATIONID.in(
                    db.withRecursive(subtree).select(subtreeId).from(subtree)));
        }
        if (blockId != null) {
            condition = condition.and(
                    LOCATION.ID.eq(blockId).or(PARENT.ID.eq(blockId)).or(GRANDPARENT.ID.eq(blockId)));
        }
        var levelPosition =
                when(LOCATION.TYPE.eq("LEVEL"), LOCATION.SORTORDER).when(PARENT.TYPE.eq("LEVEL"), PARENT.SORTORDER);
        if (minLevelPosition != null) condition = condition.and(levelPosition.ge(minLevelPosition));
        if (maxLevelPosition != null) condition = condition.and(levelPosition.le(maxLevelPosition));
        if (beforeTime != null) {
            condition = condition.and(row(ISSUEREPORT.CREATEDAT, ISSUEREPORT.ID).lt(beforeTime, beforeId));
        }
        return reportSelect()
                .where(condition)
                .orderBy(ISSUEREPORT.CREATEDAT.desc(), ISSUEREPORT.ID.desc())
                .limit(limit)
                .fetch()
                .map(ResidentReportRepository::summary);
    }

    public Optional<StoredImage> estateImage(UUID estateId, UUID reportId, UUID imageId) {
        return db.select(ISSUEREPORTIMAGE.STORAGEKEY, ISSUEREPORTIMAGE.CONTENTTYPE)
                .from(ISSUEREPORTIMAGE)
                .join(ISSUEREPORT)
                .on(ISSUEREPORT.ID.eq(ISSUEREPORTIMAGE.REPORTID))
                .where(ISSUEREPORT
                        .ID
                        .eq(reportId)
                        .and(ISSUEREPORT.ESTATEID.eq(estateId))
                        .and(ISSUEREPORTIMAGE.ID.eq(imageId)))
                .fetchOptional()
                .map(record -> new StoredImage(record.value1(), record.value2()));
    }

    public boolean hasStorageKey(String key) {
        return db.fetchExists(ISSUEREPORTIMAGE, ISSUEREPORTIMAGE.STORAGEKEY.eq(key));
    }

    private SelectJoinStep<?> reportSelect() {
        return db.select(
                        ISSUEREPORT.ID,
                        ISSUEREPORT.TITLE,
                        ISSUEREPORT.DESCRIPTION,
                        ISSUEREPORT.STATUS,
                        ISSUEREPORT.CREATEDAT,
                        ISSUEREPORT.UPDATEDAT,
                        ISSUEREPORT.LOCATIONID,
                        ESTATE.NAME,
                        LOCATION_LABEL)
                .from(ISSUEREPORT)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ISSUEREPORT.ESTATEID))
                .join(LOCATION)
                .on(LOCATION.ID.eq(ISSUEREPORT.LOCATIONID))
                .leftJoin(PARENT)
                .on(PARENT.ID.eq(LOCATION.PARENTID))
                .leftJoin(GRANDPARENT)
                .on(GRANDPARENT.ID.eq(PARENT.PARENTID));
    }

    private static IssueReportSummaryResponse summary(Record row) {
        return new IssueReportSummaryResponse(
                row.get(ISSUEREPORT.ID),
                row.get(ISSUEREPORT.TITLE),
                row.get(ISSUEREPORT.DESCRIPTION),
                row.get(ESTATE.NAME),
                new IssueReportSummaryResponse.ReportLocation(row.get(ISSUEREPORT.LOCATIONID), row.get(LOCATION_LABEL)),
                row.get(ISSUEREPORT.STATUS),
                row.get(ISSUEREPORT.CREATEDAT),
                row.get(ISSUEREPORT.UPDATEDAT));
    }

    public record StoredImage(String key, String contentType) {}
}
