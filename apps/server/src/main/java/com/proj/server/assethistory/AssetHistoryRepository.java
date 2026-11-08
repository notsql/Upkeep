package com.proj.server.assethistory;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;
import static com.proj.server.db.tables.Assetevent.ASSETEVENT;
import static com.proj.server.db.tables.Assetinspectionresult.ASSETINSPECTIONRESULT;
import static com.proj.server.db.tables.Assetlifecycleevent.ASSETLIFECYCLEEVENT;
import static com.proj.server.db.tables.Document.DOCUMENT;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Workorder.WORKORDER;
import static com.proj.server.db.tables.Workordercompletion.WORKORDERCOMPLETION;
import static org.jooq.impl.DSL.*;

import com.proj.server.asset.AssetStatus;
import com.proj.server.assethistory.AssetHistoryDetails.Type;
import com.proj.server.assethistory.AssetHistoryEntryResponse.Kind;
import com.proj.server.document.DocumentResponse;
import com.proj.server.document.DocumentType;
import com.proj.server.workorder.WorkOrderStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record3;
import org.jooq.Select;
import org.springframework.stereotype.Repository;

@Repository
public class AssetHistoryRepository {
    private final DSLContext db;

    public AssetHistoryRepository(DSLContext db) {
        this.db = db;
    }

    record Key(OffsetDateTime time, String kind, UUID id) {}

    List<AssetHistorySummaryResponse> assets(
            UUID estate, UUID asset, String query, AssetStatus status, String reference, UUID afterId, int limit) {
        var parent = LOCATION.as("history_parent");
        var grandparent = LOCATION.as("history_grandparent");
        var path = concatWs(" › ", grandparent.NAME, parent.NAME, LOCATION.NAME);
        Condition filter = ASSET.ESTATEID.eq(estate);
        if (asset != null) filter = filter.and(ASSET.ID.eq(asset));
        if (!query.isEmpty())
            filter = filter.and(ASSET.REFERENCE.containsIgnoreCase(query).or(ASSET.NAME.containsIgnoreCase(query)));
        if (status == AssetStatus.ACTIVE) filter = filter.and(ASSET.DEACTIVATEDAT.isNull());
        if (status == AssetStatus.INACTIVE) filter = filter.and(ASSET.DEACTIVATEDAT.isNotNull());
        if (reference != null)
            filter = filter.and(row(ASSET.REFERENCE, ASSET.ID).gt(reference, afterId));
        return db.select(
                        ASSET.ID,
                        ASSET.REFERENCE,
                        ASSET.NAME,
                        ASSET.CATEGORY,
                        ASSET.INSTALLEDON,
                        ASSET.RETIREDON,
                        ASSET.DEACTIVATEDAT,
                        path)
                .from(ASSET)
                .join(LOCATION)
                .on(LOCATION.ID.eq(ASSET.LOCATIONID).and(LOCATION.ESTATEID.eq(estate)))
                .leftJoin(parent)
                .on(parent.ID.eq(LOCATION.PARENTID).and(parent.ESTATEID.eq(estate)))
                .leftJoin(grandparent)
                .on(grandparent.ID.eq(parent.PARENTID).and(grandparent.ESTATEID.eq(estate)))
                .where(filter)
                .orderBy(ASSET.REFERENCE.asc(), ASSET.ID.asc())
                .limit(limit)
                .fetch(r -> new AssetHistorySummaryResponse(
                        r.get(ASSET.ID),
                        r.get(ASSET.REFERENCE),
                        r.get(ASSET.NAME),
                        r.get(ASSET.CATEGORY),
                        r.get(path),
                        r.get(ASSET.INSTALLEDON),
                        r.get(ASSET.RETIREDON),
                        r.get(ASSET.DEACTIVATEDAT) == null
                                ? AssetHistorySummaryResponse.Status.ACTIVE
                                : AssetHistorySummaryResponse.Status.RETIRED));
    }

    private static Field<OffsetDateTime> midnight(Field<LocalDate> date) {
        return field("({0}::timestamp at time zone {1})", OffsetDateTime.class, date, inline("Asia/Singapore"));
    }

    List<Key> keys(
            UUID estate,
            UUID asset,
            boolean documents,
            Key before,
            OffsetDateTime from,
            OffsetDateTime until,
            int limit) {
        Select<Record3<OffsetDateTime, String, UUID>> sources = db.select(
                        midnight(ASSETEVENT.OCCURREDON).as("sort_time"),
                        inline("MAINTENANCE").as("kind"),
                        ASSETEVENT.ID.as("source_id"))
                .from(ASSETEVENT)
                .where(ASSETEVENT.ESTATEID.eq(estate).and(ASSETEVENT.ASSETID.eq(asset)))
                .unionAll(db.select(midnight(ASSETASSESSMENT.ASSESSEDON), inline("CONDITION"), ASSETASSESSMENT.ID)
                        .from(ASSETASSESSMENT)
                        .where(ASSETASSESSMENT.ESTATEID.eq(estate).and(ASSETASSESSMENT.ASSETID.eq(asset))))
                .unionAll(db.select(
                                midnight(ASSETINSPECTIONRESULT.INSPECTEDON),
                                inline("INSPECTION"),
                                ASSETINSPECTIONRESULT.ID)
                        .from(ASSETINSPECTIONRESULT)
                        .where(ASSETINSPECTIONRESULT.ESTATEID.eq(estate).and(ASSETINSPECTIONRESULT.ASSETID.eq(asset))))
                .unionAll(db.select(ASSETLIFECYCLEEVENT.OCCURREDAT, inline("LIFECYCLE"), ASSETLIFECYCLEEVENT.ID)
                        .from(ASSETLIFECYCLEEVENT)
                        .where(ASSETLIFECYCLEEVENT.ESTATEID.eq(estate).and(ASSETLIFECYCLEEVENT.ASSETID.eq(asset))))
                .unionAll(db.select(
                                WORKORDERCOMPLETION.COMPLETEDAT, inline("WORK_ORDER_COMPLETED"), WORKORDERCOMPLETION.ID)
                        .from(WORKORDERCOMPLETION)
                        .join(WORKORDER)
                        .on(WORKORDER
                                .ID
                                .eq(WORKORDERCOMPLETION.WORKORDERID)
                                .and(WORKORDER.ESTATEID.eq(WORKORDERCOMPLETION.ESTATEID)))
                        .where(WORKORDER
                                .ESTATEID
                                .eq(estate)
                                .and(WORKORDER.ASSETID.eq(asset))
                                .and(WORKORDER.STATUS.eq(WorkOrderStatus.CLOSED.name()))));
        if (documents)
            sources = sources.unionAll(db.select(DOCUMENT.CREATEDAT, DOCUMENT.DOCUMENTTYPE, DOCUMENT.ID)
                    .from(DOCUMENT)
                    .where(DOCUMENT.ESTATEID
                            .eq(estate)
                            .and(DOCUMENT.DELETEDAT.isNull())
                            .and(DOCUMENT.ASSETID
                                    .eq(asset)
                                    .or(exists(selectOne()
                                            .from(WORKORDER)
                                            .where(WORKORDER
                                                    .ID
                                                    .eq(DOCUMENT.WORKORDERID)
                                                    .and(WORKORDER.ESTATEID.eq(estate))
                                                    .and(WORKORDER.ASSETID.eq(asset))))))));
        var history = sources.asTable("history");
        var time = field(name("history", "sort_time"), OffsetDateTime.class);
        var kind = field(name("history", "kind"), String.class);
        var id = field(name("history", "source_id"), UUID.class);
        Condition filter =
                before == null ? trueCondition() : row(time, kind, id).lt(before.time(), before.kind(), before.id());
        if (from != null) filter = filter.and(time.ge(from));
        if (until != null) filter = filter.and(time.lt(until));
        return db.select(time, kind, id)
                .from(history)
                .where(filter)
                .orderBy(time.desc(), kind.desc(), id.desc())
                .limit(limit)
                .fetch(r -> new Key(r.value1(), r.value2(), r.value3()));
    }

    List<AssetHistoryEntryResponse> entries(UUID estate, List<Key> keys, boolean sourceLinks) {
        Map<String, AssetHistoryEntryResponse> entries = new HashMap<>();
        var ids = keys.stream().map(Key::id).toList();
        if (ids.isEmpty()) return List.of();
        for (var r : db.selectFrom(ASSETEVENT)
                .where(ASSETEVENT.ESTATEID.eq(estate).and(ASSETEVENT.ID.in(ids)))
                .fetch()) {
            add(
                    entries,
                    r.getId(),
                    Kind.MAINTENANCE,
                    "PREVENTIVE".equals(r.getType()) ? "Preventive maintenance" : "Repair recorded",
                    r.getNotes(),
                    r.getOccurredon(),
                    null,
                    r.getCreatedat(),
                    new AssetHistoryDetails.Maintenance(
                            Type.MAINTENANCE,
                            r.getType(),
                            r.getNotes(),
                            r.getFindings(),
                            r.getWorkperformed(),
                            r.getServiceprovider(),
                            r.getPartsreplaced(),
                            r.getDowntimeminutes(),
                            money(r.getLabourcost()),
                            money(r.getPartscost()),
                            money(r.getOthercost()),
                            total(r.getLabourcost(), r.getPartscost(), r.getOthercost())));
        }
        for (var r : db.selectFrom(ASSETASSESSMENT)
                .where(ASSETASSESSMENT.ESTATEID.eq(estate).and(ASSETASSESSMENT.ID.in(ids)))
                .fetch()) {
            boolean model = "system:anomaly-model".equals(r.getRecordedbyuserid());
            add(
                    entries,
                    r.getId(),
                    Kind.CONDITION,
                    "Condition assessed",
                    r.getNotes(),
                    r.getAssessedon(),
                    null,
                    r.getCreatedat(),
                    new AssetHistoryDetails.Condition(
                            Type.CONDITION,
                            r.getCondition(),
                            r.getAssessedon(),
                            r.getNotes(),
                            model ? AssetHistoryDetails.Origin.ANOMALY_MODEL : AssetHistoryDetails.Origin.HUMAN,
                            model ? "Anomaly detection" : "Human assessment"));
        }
        for (var r : db.selectFrom(ASSETINSPECTIONRESULT)
                .where(ASSETINSPECTIONRESULT.ESTATEID.eq(estate).and(ASSETINSPECTIONRESULT.ID.in(ids)))
                .fetch()) {
            add(
                    entries,
                    r.getId(),
                    Kind.INSPECTION,
                    "Inspection recorded",
                    r.getNotes(),
                    r.getInspectedon(),
                    null,
                    r.getCreatedat(),
                    new AssetHistoryDetails.Inspection(
                            Type.INSPECTION,
                            r.getOutcome(),
                            r.getInspectedon(),
                            r.getNotes(),
                            r.getLocationpath(),
                            sourceLinks));
        }
        for (var r : db.selectFrom(ASSETLIFECYCLEEVENT)
                .where(ASSETLIFECYCLEEVENT.ESTATEID.eq(estate).and(ASSETLIFECYCLEEVENT.ID.in(ids)))
                .fetch()) {
            String title = switch (r.getAction()) {
                case "RETIRED" -> "Asset retired";
                case "RESTORED" -> "Asset restored";
                default -> "Retirement corrected";
            };
            add(
                    entries,
                    r.getId(),
                    Kind.LIFECYCLE,
                    title,
                    r.getRetirementreason(),
                    null,
                    r.getOccurredat(),
                    r.getOccurredat(),
                    new AssetHistoryDetails.Lifecycle(
                            Type.LIFECYCLE,
                            r.getAction(),
                            r.getPreviousretiredon(),
                            r.getPreviousretirementreason(),
                            r.getRetiredon(),
                            r.getRetirementreason(),
                            r.getLifecycleversion()));
        }
        for (var row : db.select(WORKORDERCOMPLETION.fields())
                .select(WORKORDER.REFERENCE)
                .from(WORKORDERCOMPLETION)
                .join(WORKORDER)
                .on(WORKORDER.ID.eq(WORKORDERCOMPLETION.WORKORDERID).and(WORKORDER.ESTATEID.eq(estate)))
                .where(WORKORDERCOMPLETION.ESTATEID.eq(estate).and(WORKORDERCOMPLETION.ID.in(ids)))
                .fetch()) {
            var r = row.into(WORKORDERCOMPLETION);
            add(
                    entries,
                    r.getId(),
                    Kind.WORK_ORDER_COMPLETED,
                    "Work order completed",
                    r.getWorkperformed(),
                    null,
                    r.getCompletedat(),
                    r.getCompletedat(),
                    new AssetHistoryDetails.Completion(
                            Type.COMPLETION,
                            r.getWorkorderid(),
                            row.get(WORKORDER.REFERENCE),
                            r.getFindings(),
                            r.getWorkperformed(),
                            r.getPartsused(),
                            money(r.getLabourcost()),
                            money(r.getPartscost()),
                            total(r.getLabourcost(), r.getPartscost()),
                            r.getCurrency(),
                            r.getDowntimeminutes(),
                            r.getEditedat(),
                            sourceLinks));
        }
        for (var r : db.selectFrom(DOCUMENT)
                .where(DOCUMENT.ESTATEID.eq(estate).and(DOCUMENT.ID.in(ids)).and(DOCUMENT.DELETEDAT.isNull()))
                .fetch()) {
            var kind = Kind.valueOf(r.getDocumenttype());
            add(
                    entries,
                    r.getId(),
                    kind,
                    kind == Kind.INVOICE ? "Invoice uploaded" : "Service report uploaded",
                    r.getOriginalfilename(),
                    null,
                    r.getCreatedat(),
                    r.getCreatedat(),
                    new AssetHistoryDetails.Document(
                            Type.DOCUMENT,
                            new DocumentResponse(
                                    r.getId(),
                                    estate,
                                    DocumentType.valueOf(r.getDocumenttype()),
                                    r.getOriginalfilename(),
                                    r.getContenttype(),
                                    r.getSizebytes(),
                                    r.getCreatedat(),
                                    false)));
        }
        return keys.stream().map(k -> entries.get(k.kind() + ":" + k.id())).toList();
    }

    private static void add(
            Map<String, AssetHistoryEntryResponse> entries,
            UUID id,
            Kind kind,
            String title,
            String summary,
            LocalDate on,
            OffsetDateTime at,
            OffsetDateTime recordedAt,
            AssetHistoryDetails details) {
        String key = kind + ":" + id;
        entries.put(key, new AssetHistoryEntryResponse(key, id, kind, title, summary, on, at, recordedAt, details));
    }

    private static String money(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }

    private static String total(BigDecimal... values) {
        BigDecimal total = BigDecimal.ZERO;
        for (var value : values) {
            if (value == null) return null;
            total = total.add(value);
        }
        return money(total);
    }
}
