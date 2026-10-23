package com.proj.server.workorder;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Workorder.WORKORDER;

import com.proj.server.db.tables.records.EstateRecord;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.*;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class WorkOrderRepository {
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

    public UUID create(UUID estateId, String code, String user, CreateWorkOrderRequest request) {
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
                .set(WORKORDER.SOURCEREFERENCE, request.sourceReference())
                .set(WORKORDER.STATUS, "OPEN")
                .set(WORKORDER.CREATEDBYUSERID, user)
                .set(WORKORDER.CREATEDAT, now)
                .set(WORKORDER.UPDATEDAT, now)
                .execute();
        return id;
    }

    public WorkOrderResponse detail(UUID estateId, UUID id) {
        return orders(WORKORDER.ESTATEID.eq(estateId).and(WORKORDER.ID.eq(id))).fetchOne(this::response);
    }

    public List<WorkOrderResponse> list(
            UUID estateId,
            WorkOrderPriority priority,
            String query,
            WorkOrderSort sort,
            WorkOrderSortDirection direction,
            UUID id,
            int limit) {
        Condition condition = WORKORDER.ESTATEID.eq(estateId);
        if (priority != null) condition = condition.and(WORKORDER.PRIORITY.eq(priority.name()));
        if (query != null && !query.isBlank()) condition = condition.and(WORKORDER.REFERENCE.containsIgnoreCase(query));
        return switch (sort) {
            case CREATED_AT -> sortedList(estateId, condition, WORKORDER.CREATEDAT, direction, id, limit);
            case CATEGORY -> sortedList(estateId, condition, WORKORDER.CATEGORY, direction, id, limit);
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
                        limit);
            case REFERENCE ->
                sortedList(
                        estateId,
                        condition,
                        DSL.field(
                                "substring({0} from '[0-9]+$')::numeric",
                                java.math.BigDecimal.class, WORKORDER.REFERENCE),
                        direction,
                        id,
                        limit);
        };
    }

    private <T> List<WorkOrderResponse> sortedList(
            UUID estateId,
            Condition condition,
            Field<T> key,
            WorkOrderSortDirection direction,
            UUID cursor,
            int limit) {
        boolean ascending = direction == WorkOrderSortDirection.ASC;
        if (cursor != null) {
            var value = db.select(key)
                    .from(WORKORDER)
                    .where(WORKORDER.ESTATEID.eq(estateId).and(WORKORDER.ID.eq(cursor)))
                    .fetchOne(key);
            if (value == null)
                throw new WorkOrderException(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid work-order cursor.");
            condition = condition.and((ascending ? key.gt(value) : key.lt(value))
                    .or(key.eq(value).and(ascending ? WORKORDER.ID.gt(cursor) : WORKORDER.ID.lt(cursor))));
        }
        return orders(condition)
                .orderBy(ascending ? key.asc() : key.desc(), ascending ? WORKORDER.ID.asc() : WORKORDER.ID.desc())
                .limit(limit)
                .fetch(this::response);
    }

    private SelectJoinStep<org.jooq.Record> orderJoins() {
        var parent = LOCATION.as("parent");
        var grandparent = LOCATION.as("grandparent");
        return db.select(WORKORDER.fields())
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
                .on(ASSET.ID.eq(WORKORDER.ASSETID).and(ASSET.ESTATEID.eq(WORKORDER.ESTATEID)));
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
                row.get(WORKORDER.SOURCEREFERENCE),
                WorkOrderStatus.valueOf(row.get(WORKORDER.STATUS)),
                row.get(WORKORDER.CREATEDBYUSERID),
                null,
                row.get(WORKORDER.CREATEDAT),
                row.get(WORKORDER.UPDATEDAT));
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
