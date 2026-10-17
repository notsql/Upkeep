package com.proj.server.resident;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class ResidentReportRepository {
    private static final String REPORT_SELECT = """
            select r.id, r.title, r.description, r.status, r."createdAt" as created_at,
                   r."updatedAt" as updated_at, r."locationId" as location_id,
                   e.name as estate_name,
                   concat_ws(' › ', grandparent.name, parent.name, location.name) as location_label
            from "IssueReport" r
            join "Estate" e on e.id=r."estateId"
            join "Location" location on location.id=r."locationId"
            left join "Location" parent on parent.id=location."parentId"
            left join "Location" grandparent on grandparent.id=parent."parentId"
            """;

    private final DSLContext db;

    public ResidentReportRepository(DSLContext db) {
        this.db = db;
    }

    public Optional<ResidentContextResponse.EstateLabel> activeAssignment(String userId, boolean lock) {
        var query = db.select(ESTATE.ID, ESTATE.NAME)
                .from(ESTATEUSER)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ESTATEUSER.ESTATEID))
                .where(ESTATEUSER
                        .USERID
                        .eq(userId)
                        .and(ESTATEUSER.ROLE.eq("RESIDENT"))
                        .and(ESTATE.DEACTIVATEDAT.isNull()));
        return (lock ? query.forUpdate().of(ESTATEUSER, ESTATE).fetchOptional() : query.fetchOptional())
                .map(row -> new ResidentContextResponse.EstateLabel(row.value1(), row.value2()));
    }

    public boolean hasResidentMembership(String userId) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.USERID.eq(userId).and(ESTATEUSER.ROLE.eq("RESIDENT")));
    }

    public List<ResidentLocationResponse> activeLocations(UUID estateId) {
        return db.fetch("""
                select location.id, location.type, location.name,
                       location."parentId" as parent_id, location."sortOrder" as sort_order
                from "Location" location
                left join "Location" parent on parent.id=location."parentId"
                left join "Location" grandparent on grandparent.id=parent."parentId"
                where location."estateId"=? and location."deactivatedAt" is null
                  and (parent.id is null or parent."deactivatedAt" is null)
                  and (grandparent.id is null or grandparent."deactivatedAt" is null)
                order by location.type, location."sortOrder" nulls last, location.name, location.id
                """, estateId)
                .map(row -> new ResidentLocationResponse(
                        row.get("id", UUID.class),
                        row.get("type", String.class),
                        row.get("name", String.class),
                        row.get("parent_id", UUID.class),
                        row.get("sort_order", Integer.class)));
    }

    public boolean activeReportLocation(UUID estateId, UUID locationId) {
        return db.fetchOne("""
                select 1 from "Location" location
                left join "Location" parent on parent.id=location."parentId"
                left join "Location" grandparent on grandparent.id=parent."parentId"
                where location.id=? and location."estateId"=?
                  and location.type in ('LEVEL', 'COMMON_AREA')
                  and location."deactivatedAt" is null
                  and parent."deactivatedAt" is null
                  and (grandparent.id is null or grandparent."deactivatedAt" is null)
                """, locationId, estateId) != null;
    }

    public void create(UUID id, String userId, UUID estateId, UUID locationId, String title, String description) {
        db.execute("""
                insert into "IssueReport" (id, "submittedByUserId", "estateId", "locationId",
                    title, description, status, "createdAt", "updatedAt")
                values (?, ?, ?, ?, ?, ?, 'SUBMITTED', now(), now())
                """, id, userId, estateId, locationId, title, description);
    }

    public void addImage(UUID id, UUID reportId, String storageKey, String contentType, int sizeBytes) {
        db.execute(
                "insert into \"IssueReportImage\" (id, \"reportId\", \"storageKey\", \"contentType\", \"sizeBytes\") values (?, ?, ?, ?, ?)",
                id,
                reportId,
                storageKey,
                contentType,
                sizeBytes);
    }

    public Optional<IssueReportDetailResponse> detail(String userId, UUID reportId) {
        var row = db.fetchOne(REPORT_SELECT + " where r.id=? and r.\"submittedByUserId\"=?", reportId, userId);
        if (row == null) {
            return Optional.empty();
        }
        var images = db.fetch(
                        "select id, \"contentType\" as content_type from \"IssueReportImage\" where \"reportId\"=? order by \"createdAt\", id",
                        reportId)
                .map(image -> new IssueReportDetailResponse.ReportImage(
                        image.get("id", UUID.class), image.get("content_type", String.class)));
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

    public List<IssueReportSummaryResponse> list(String userId, OffsetDateTime beforeTime, UUID beforeId, int limit) {
        String condition = beforeTime == null
                ? " where r.\"submittedByUserId\"=?"
                : " where r.\"submittedByUserId\"=? and (r.\"createdAt\", r.id) < (?::timestamptz, ?::uuid)";
        String sql = REPORT_SELECT + condition + " order by r.\"createdAt\" desc, r.id desc limit ?";
        var rows =
                beforeTime == null ? db.fetch(sql, userId, limit) : db.fetch(sql, userId, beforeTime, beforeId, limit);
        return rows.map(ResidentReportRepository::summary);
    }

    public Optional<StoredImage> image(String userId, UUID reportId, UUID imageId) {
        var row = db.fetchOne("""
                select image."storageKey" as storage_key, image."contentType" as content_type
                from "IssueReportImage" image
                join "IssueReport" report on report.id=image."reportId"
                where report.id=? and report."submittedByUserId"=? and image.id=?
                """, reportId, userId, imageId);
        return Optional.ofNullable(row)
                .map(record -> new StoredImage(
                        record.get("storage_key", String.class), record.get("content_type", String.class)));
    }

    public boolean hasStorageKey(String key) {
        return db.fetchOne("select 1 from \"IssueReportImage\" where \"storageKey\"=?", key) != null;
    }

    private static IssueReportSummaryResponse summary(Record row) {
        return new IssueReportSummaryResponse(
                row.get("id", UUID.class),
                row.get("title", String.class),
                row.get("description", String.class),
                row.get("estate_name", String.class),
                new IssueReportSummaryResponse.ReportLocation(
                        row.get("location_id", UUID.class), row.get("location_label", String.class)),
                row.get("status", String.class),
                row.get("created_at", OffsetDateTime.class),
                row.get("updated_at", OffsetDateTime.class));
    }

    public record StoredImage(String key, String contentType) {}
}
