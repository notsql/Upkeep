package com.proj.server.workorder;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Workorder.WORKORDER;
import static com.proj.server.db.tables.Workordercompletion.WORKORDERCOMPLETION;

import com.proj.server.db.tables.records.EstateRecord;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.*;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class WorkOrderRepository {
    private static final tools.jackson.databind.json.JsonMapper JSON =
            tools.jackson.databind.json.JsonMapper.builder().build();
    private final DSLContext db;

    public WorkOrderRepository(DSLContext db) {
        this.db = db;
    }

    public EstateRecord estate(UUID estateId, boolean lock) {
        var query = db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId));
        return lock ? query.forUpdate().fetchOne() : query.fetchOne();
    }

    public String role(UUID estateId, String user) {
        return db.select(ESTATEUSER.ROLE)
                .from(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(user)))
                .fetchOne(ESTATEUSER.ROLE);
    }

    public UUID reportLocation(UUID estateId, UUID reportId) {
        return db.select(ISSUEREPORT.LOCATIONID)
                .from(ISSUEREPORT)
                .where(ISSUEREPORT.ESTATEID.eq(estateId).and(ISSUEREPORT.ID.eq(reportId)))
                .fetchOne(ISSUEREPORT.LOCATIONID);
    }

    public com.proj.server.db.tables.records.AssetRecord asset(UUID estateId, UUID assetId) {
        return db.selectFrom(ASSET)
                .where(ASSET.ESTATEID.eq(estateId).and(ASSET.ID.eq(assetId)))
                .fetchOne();
    }

    public com.proj.server.db.tables.records.AssetinspectionresultRecord inspection(UUID estate, UUID id) {
        var table = com.proj.server.db.tables.Assetinspectionresult.ASSETINSPECTIONRESULT;
        return db.selectFrom(table)
                .where(table.ESTATEID.eq(estate).and(table.ID.eq(id)))
                .fetchOne();
    }

    public String inspectionOrder(UUID estate, UUID inspection) {
        return db.select(WORKORDER.REFERENCE)
                .from(WORKORDER)
                .where(WORKORDER.ESTATEID.eq(estate).and(WORKORDER.SOURCEINSPECTIONID.eq(inspection)))
                .fetchOne(WORKORDER.REFERENCE);
    }

    public UUID create(
            UUID estateId, String code, String user, CreateWorkOrderRequest request, String sourceReference) {
        long sequence = db.selectCount()
                        .from(WORKORDER)
                        .where(WORKORDER.ESTATEID.eq(estateId))
                        .fetchSingle(0, Long.class)
                + 1;
        var id = UUID.randomUUID();
        var now = OffsetDateTime.now(java.time.ZoneOffset.UTC);
        db.insertInto(WORKORDER)
                .set(WORKORDER.ID, id)
                .set(WORKORDER.ESTATEID, estateId)
                .set(WORKORDER.REFERENCE, code + "-W" + String.format(java.util.Locale.ROOT, "%04d", sequence))
                .set(WORKORDER.DESCRIPTION, request.description())
                .set(WORKORDER.LOCATIONID, request.locationId())
                .set(WORKORDER.ASSETID, request.assetId())
                .set(WORKORDER.CATEGORY, request.category().name())
                .set(WORKORDER.PRIORITY, request.priority().name())
                .set(WORKORDER.SOURCE, request.source().name())
                .set(WORKORDER.SOURCEREPORTID, request.sourceReportId())
                .set(WORKORDER.SOURCEINSPECTIONID, request.sourceInspectionId())
                .set(WORKORDER.SOURCEREFERENCE, sourceReference)
                .set(WORKORDER.STATUS, "OPEN")
                .set(WORKORDER.CREATEDBYUSERID, user)
                .set(WORKORDER.CREATEDAT, now)
                .set(WORKORDER.UPDATEDAT, now)
                .execute();
        appendStatus(id, estateId, null, WorkOrderStatus.OPEN, user, null, now, 0);
        return id;
    }

    public WorkOrderResponse detail(UUID estateId, UUID id) {
        return orders(WORKORDER.ESTATEID.eq(estateId).and(WORKORDER.ID.eq(id))).fetchOne(this::response);
    }

    public List<WorkOrderResponse> list(
            UUID estateId,
            WorkOrderPriority priority,
            WorkOrderStatus status,
            WorkOrderCategory category,
            String query,
            WorkOrderSort sort,
            WorkOrderSortDirection direction,
            UUID id,
            int limit) {
        Condition condition = WORKORDER.ESTATEID.eq(estateId);
        if (status != null) condition = condition.and(WORKORDER.STATUS.eq(status.name()));
        if (category != null) condition = condition.and(WORKORDER.CATEGORY.eq(category.name()));
        if (priority != null) condition = condition.and(WORKORDER.PRIORITY.eq(priority.name()));
        if (query != null && !query.isBlank()) condition = condition.and(WORKORDER.REFERENCE.containsIgnoreCase(query));
        return switch (sort) {
            case CREATED_AT -> sortedList(estateId, condition, WORKORDER.CREATEDAT, direction, id, limit, false);
            case CATEGORY -> sortedList(estateId, condition, WORKORDER.CATEGORY, direction, id, limit, false);
            case PRIORITY ->
                sortedList(
                        estateId,
                        condition,
                        DSL.choose(WORKORDER.PRIORITY)
                                .when("LOW", 0)
                                .when("MEDIUM", 1)
                                .when("HIGH", 2)
                                .otherwise(3),
                        direction,
                        id,
                        limit,
                        true);
            case REFERENCE ->
                sortedList(
                        estateId,
                        condition,
                        DSL.field(
                                "substring({0} from '[0-9]+$')::numeric",
                                java.math.BigDecimal.class, WORKORDER.REFERENCE),
                        direction,
                        id,
                        limit,
                        false);
        };
    }

    private <T> List<WorkOrderResponse> sortedList(
            UUID estateId,
            Condition condition,
            Field<T> key,
            WorkOrderSortDirection direction,
            UUID cursor,
            int limit,
            boolean oldestTies) {
        boolean ascending = direction == WorkOrderSortDirection.ASC;
        if (cursor != null) {
            var row = db.select(key, WORKORDER.CREATEDAT)
                    .from(WORKORDER)
                    .where(WORKORDER.ESTATEID.eq(estateId).and(WORKORDER.ID.eq(cursor)))
                    .fetchOne();
            if (row == null)
                throw new WorkOrderException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid work-order cursor.");
            var value = row.get(key);
            Condition tie = ascending ? WORKORDER.ID.gt(cursor) : WORKORDER.ID.lt(cursor);
            if (oldestTies) {
                var time = row.get(WORKORDER.CREATEDAT);
                tie = WORKORDER
                        .CREATEDAT
                        .gt(time)
                        .or(WORKORDER.CREATEDAT.eq(time).and(WORKORDER.ID.lt(cursor)));
            }
            condition = condition.and(
                    (ascending ? key.gt(value) : key.lt(value)).or(key.eq(value).and(tie)));
        }
        var ordering = new java.util.ArrayList<org.jooq.SortField<?>>();
        ordering.add(ascending ? key.asc() : key.desc());
        if (oldestTies) ordering.add(WORKORDER.CREATEDAT.asc());
        ordering.add(ascending && !oldestTies ? WORKORDER.ID.asc() : WORKORDER.ID.desc());
        return orders(condition).orderBy(ordering).limit(limit).fetch(this::response);
    }

    private SelectJoinStep<org.jooq.Record> orderJoins() {
        var parent = LOCATION.as("parent");
        var grandparent = LOCATION.as("grandparent");
        return db.select(WORKORDER.fields())
                .select(WORKORDERCOMPLETION.fields())
                .select(ASSET.REFERENCE.as("assetReference"))
                .select(DSL.concatWs(" / ", grandparent.NAME, parent.NAME, LOCATION.NAME)
                        .as("locationPath"))
                .from(WORKORDER)
                .join(LOCATION)
                .on(LOCATION.ID.eq(WORKORDER.LOCATIONID).and(LOCATION.ESTATEID.eq(WORKORDER.ESTATEID)))
                .leftJoin(parent)
                .on(parent.ID.eq(LOCATION.PARENTID).and(parent.ESTATEID.eq(LOCATION.ESTATEID)))
                .leftJoin(grandparent)
                .on(grandparent.ID.eq(parent.PARENTID).and(grandparent.ESTATEID.eq(LOCATION.ESTATEID)))
                .leftJoin(ASSET)
                .on(ASSET.ID.eq(WORKORDER.ASSETID).and(ASSET.ESTATEID.eq(WORKORDER.ESTATEID)))
                .leftJoin(WORKORDERCOMPLETION)
                .on(WORKORDERCOMPLETION
                        .WORKORDERID
                        .eq(WORKORDER.ID)
                        .and(WORKORDERCOMPLETION.ESTATEID.eq(WORKORDER.ESTATEID)));
    }

    private SelectConditionStep<org.jooq.Record> orders(Condition condition) {
        return orderJoins().where(condition);
    }

    private WorkOrderResponse response(org.jooq.Record row) {
        return new WorkOrderResponse(
                row.get(WORKORDER.ID),
                row.get(WORKORDER.ESTATEID),
                row.get(WORKORDER.REFERENCE),
                row.get(WORKORDER.DESCRIPTION),
                row.get(WORKORDER.LOCATIONID),
                row.get("locationPath", String.class),
                row.get(WORKORDER.ASSETID),
                row.get("assetReference", String.class),
                WorkOrderCategory.valueOf(row.get(WORKORDER.CATEGORY)),
                WorkOrderPriority.valueOf(row.get(WORKORDER.PRIORITY)),
                WorkOrderSource.valueOf(row.get(WORKORDER.SOURCE)),
                row.get(WORKORDER.SOURCEREPORTID),
                row.get(WORKORDER.SOURCEINSPECTIONID),
                row.get(WORKORDER.SOURCEREFERENCE),
                WorkOrderStatus.valueOf(row.get(WORKORDER.STATUS)),
                row.get(WORKORDER.VERSION),
                WorkOrderCompletionResponse.from(row.into(WORKORDERCOMPLETION)),
                row.get(WORKORDER.CREATEDBYUSERID),
                null,
                row.get(WORKORDER.CREATEDAT),
                row.get(WORKORDER.UPDATEDAT));
    }

    public com.proj.server.db.tables.records.WorkorderRecord lockOrder(UUID estateId, UUID id) {
        return db.selectFrom(WORKORDER)
                .where(WORKORDER.ESTATEID.eq(estateId).and(WORKORDER.ID.eq(id)))
                .forUpdate()
                .fetchOne();
    }

    public void appendStatus(
            UUID id,
            UUID estate,
            WorkOrderStatus from,
            WorkOrderStatus to,
            String user,
            String name,
            OffsetDateTime now,
            int version) {
        var event = com.proj.server.db.tables.Workorderstatusevent.WORKORDERSTATUSEVENT;
        db.insertInto(event)
                .set(event.ID, UUID.randomUUID())
                .set(event.ESTATEID, estate)
                .set(event.WORKORDERID, id)
                .set(event.FROMSTATUS, from == null ? null : from.name())
                .set(event.TOSTATUS, to.name())
                .set(event.CHANGEDBYUSERID, user)
                .set(event.CHANGEDBYNAME, name)
                .set(event.CHANGEDAT, now)
                .set(event.VERSION, version)
                .execute();
    }

    public void updateStatus(UUID id, WorkOrderStatus status, OffsetDateTime now, int version) {
        db.update(WORKORDER)
                .set(WORKORDER.STATUS, status.name())
                .set(WORKORDER.VERSION, version)
                .set(WORKORDER.UPDATEDAT, now)
                .where(WORKORDER.ID.eq(id))
                .execute();
    }

    public void complete(
            UUID estate,
            UUID id,
            String user,
            String name,
            SaveWorkOrderCompletionRequest request,
            OffsetDateTime now) {
        db.insertInto(WORKORDERCOMPLETION)
                .set(WORKORDERCOMPLETION.ID, UUID.randomUUID())
                .set(WORKORDERCOMPLETION.ESTATEID, estate)
                .set(WORKORDERCOMPLETION.WORKORDERID, id)
                .set(WORKORDERCOMPLETION.FINDINGS, request.findings())
                .set(WORKORDERCOMPLETION.WORKPERFORMED, request.workPerformed())
                .set(WORKORDERCOMPLETION.PARTSUSED, request.partsUsed())
                .set(WORKORDERCOMPLETION.LABOURCOST, money(request.labourCost()))
                .set(WORKORDERCOMPLETION.PARTSCOST, money(request.partsCost()))
                .set(WORKORDERCOMPLETION.DOWNTIMEMINUTES, request.downtimeMinutes())
                .set(WORKORDERCOMPLETION.COMPLETEDBYUSERID, user)
                .set(WORKORDERCOMPLETION.COMPLETEDBYNAME, name)
                .set(WORKORDERCOMPLETION.COMPLETEDAT, now)
                .execute();
    }

    public void correctCompletion(
            UUID estate,
            UUID id,
            String user,
            String name,
            SaveWorkOrderCompletionRequest request,
            OffsetDateTime now) {
        db.update(WORKORDERCOMPLETION)
                .set(WORKORDERCOMPLETION.FINDINGS, request.findings())
                .set(WORKORDERCOMPLETION.WORKPERFORMED, request.workPerformed())
                .set(WORKORDERCOMPLETION.PARTSUSED, request.partsUsed())
                .set(WORKORDERCOMPLETION.LABOURCOST, money(request.labourCost()))
                .set(WORKORDERCOMPLETION.PARTSCOST, money(request.partsCost()))
                .set(WORKORDERCOMPLETION.DOWNTIMEMINUTES, request.downtimeMinutes())
                .set(WORKORDERCOMPLETION.EDITEDBYUSERID, user)
                .set(WORKORDERCOMPLETION.EDITEDBYNAME, name)
                .set(WORKORDERCOMPLETION.EDITEDAT, now)
                .where(WORKORDERCOMPLETION.WORKORDERID.eq(id).and(WORKORDERCOMPLETION.ESTATEID.eq(estate)))
                .execute();
    }

    public void appendRevision(UUID estate, UUID id, WorkOrderCompletionRevisionResponse revision) {
        var table = com.proj.server.db.tables.Workordercompletionrevision.WORKORDERCOMPLETIONREVISION;
        db.insertInto(table)
                .set(table.ID, revision.id())
                .set(table.ESTATEID, estate)
                .set(table.WORKORDERID, id)
                .set(table.FROMVERSION, revision.fromVersion())
                .set(table.VERSION, revision.version())
                .set(table.CORRECTIONREASON, revision.correctionReason())
                .set(table.CHANGEDBYUSERID, revision.changedByUserId())
                .set(table.CHANGEDBYNAME, revision.changedByName())
                .set(table.CHANGEDAT, revision.changedAt())
                .set(table.BEFOREOUTCOME, org.jooq.JSONB.valueOf(JSON.writeValueAsString(revision.before())))
                .set(table.AFTEROUTCOME, org.jooq.JSONB.valueOf(JSON.writeValueAsString(revision.after())))
                .execute();
    }

    public List<WorkOrderCompletionRevisionResponse> revisions(UUID estate, UUID id) {
        var table = com.proj.server.db.tables.Workordercompletionrevision.WORKORDERCOMPLETIONREVISION;
        return db.selectFrom(table)
                .where(table.ESTATEID.eq(estate).and(table.WORKORDERID.eq(id)))
                .orderBy(table.VERSION.asc())
                .fetch(this::revision);
    }

    public WorkOrderCompletionRevisionResponse latestRevision(UUID estate, UUID id) {
        var table = com.proj.server.db.tables.Workordercompletionrevision.WORKORDERCOMPLETIONREVISION;
        return db.selectFrom(table)
                .where(table.ESTATEID.eq(estate).and(table.WORKORDERID.eq(id)))
                .orderBy(table.VERSION.desc())
                .limit(1)
                .fetchOne(this::revision);
    }

    private WorkOrderCompletionRevisionResponse revision(
            com.proj.server.db.tables.records.WorkordercompletionrevisionRecord row) {
        return new WorkOrderCompletionRevisionResponse(
                row.getId(),
                row.getFromversion(),
                row.getVersion(),
                row.getCorrectionreason(),
                row.getChangedbyuserid(),
                row.getChangedbyname(),
                row.getChangedat(),
                JSON.readValue(row.getBeforeoutcome().data(), WorkOrderCompletionResponse.class),
                JSON.readValue(row.getAfteroutcome().data(), WorkOrderCompletionResponse.class));
    }

    static java.math.BigDecimal money(String value) {
        return value == null ? null : new java.math.BigDecimal(value).setScale(2);
    }

    public List<WorkOrderStatusEventResponse> history(UUID estate, UUID id) {
        var event = com.proj.server.db.tables.Workorderstatusevent.WORKORDERSTATUSEVENT;
        return db.selectFrom(event)
                .where(event.ESTATEID.eq(estate).and(event.WORKORDERID.eq(id)))
                .orderBy(event.VERSION, event.ID)
                .fetch(row -> new WorkOrderStatusEventResponse(
                        row.getId(),
                        row.getFromstatus() == null ? null : WorkOrderStatus.valueOf(row.getFromstatus()),
                        WorkOrderStatus.valueOf(row.getTostatus()),
                        row.getChangedbyuserid(),
                        row.getChangedbyname(),
                        row.getChangedat(),
                        row.getVersion()));
    }

    public List<AssetWorkOrderCompletionResponse> completions(UUID estate, UUID asset) {
        return orders(WORKORDER
                        .ESTATEID
                        .eq(estate)
                        .and(WORKORDER.ASSETID.eq(asset))
                        .and(WORKORDERCOMPLETION.ID.isNotNull()))
                .orderBy(WORKORDERCOMPLETION.COMPLETEDAT.desc(), WORKORDERCOMPLETION.ID.desc())
                .fetch(row -> new AssetWorkOrderCompletionResponse(
                        row.get(WORKORDER.ID),
                        row.get(WORKORDER.REFERENCE),
                        row.get("locationPath", String.class),
                        WorkOrderCompletionResponse.from(row.into(WORKORDERCOMPLETION))));
    }

    public List<WorkOrderAssetOptionResponse> assets(
            UUID estateId, String query, String reference, UUID id, int limit) {
        var parent = LOCATION.as("parent");
        var grandparent = LOCATION.as("grandparent");
        Condition condition = ASSET.ESTATEID
                .eq(estateId)
                .and(ASSET.DEACTIVATEDAT.isNull())
                .and(ASSET.RETIREDON.isNull())
                .and(LOCATION.DEACTIVATEDAT.isNull())
                .and(parent.DEACTIVATEDAT.isNull())
                .and(grandparent.DEACTIVATEDAT.isNull());
        if (query != null && !query.isBlank())
            condition =
                    condition.and(ASSET.NAME.containsIgnoreCase(query).or(ASSET.REFERENCE.containsIgnoreCase(query)));
        if (reference != null)
            condition = condition.and(ASSET.REFERENCE
                    .gt(reference)
                    .or(ASSET.REFERENCE.eq(reference).and(ASSET.ID.gt(id))));
        return db.select(ASSET.ID, ASSET.REFERENCE, ASSET.NAME, ASSET.LOCATIONID)
                .select(DSL.concatWs(" / ", grandparent.NAME, parent.NAME, LOCATION.NAME)
                        .as("locationPath"))
                .from(ASSET)
                .join(LOCATION)
                .on(LOCATION.ID.eq(ASSET.LOCATIONID).and(LOCATION.ESTATEID.eq(ASSET.ESTATEID)))
                .leftJoin(parent)
                .on(parent.ID.eq(LOCATION.PARENTID).and(parent.ESTATEID.eq(LOCATION.ESTATEID)))
                .leftJoin(grandparent)
                .on(grandparent.ID.eq(parent.PARENTID).and(grandparent.ESTATEID.eq(LOCATION.ESTATEID)))
                .where(condition)
                .orderBy(ASSET.REFERENCE, ASSET.ID)
                .limit(limit)
                .fetch(row -> new WorkOrderAssetOptionResponse(
                        row.get(ASSET.ID),
                        row.get(ASSET.REFERENCE),
                        row.get(ASSET.NAME),
                        row.get(ASSET.LOCATIONID),
                        row.get("locationPath", String.class)));
    }
}
