package com.proj.server.cost;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetcategory.ASSETCATEGORY;
import static com.proj.server.db.tables.Assetevent.ASSETEVENT;
import static com.proj.server.db.tables.Assetinspectionresult.ASSETINSPECTIONRESULT;
import static com.proj.server.db.tables.Workorder.WORKORDER;
import static com.proj.server.db.tables.Workordercompletion.WORKORDERCOMPLETION;

import com.proj.server.db.tables.records.AssetRecord;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/** Cost entries of an estate: manual maintenance entries and completed work orders (ID-50 rules). */
@Repository
public class EstateCostRepository {
    private final DSLContext db;

    public EstateCostRepository(DSLContext db) {
        this.db = db;
    }

    /** Every cost entry of the estate's assets, active or retired. */
    List<CostEntry> entries(UUID estateId) {
        var entries = new ArrayList<CostEntry>();
        db.select(
                        ASSETEVENT.ASSETID,
                        ASSET.CATEGORY,
                        ASSETEVENT.TYPE,
                        ASSETEVENT.LABOURCOST,
                        ASSETEVENT.PARTSCOST,
                        ASSETEVENT.OTHERCOST)
                .from(ASSETEVENT)
                .join(ASSET)
                .on(ASSET.ID.eq(ASSETEVENT.ASSETID))
                .where(ASSETEVENT.ESTATEID.eq(estateId))
                .forEach(row -> entries.add(new CostEntry(
                        row.get(ASSETEVENT.ASSETID),
                        row.get(ASSET.CATEGORY),
                        "PREVENTIVE".equals(row.get(ASSETEVENT.TYPE)),
                        "BREAKDOWN_REPAIR".equals(row.get(ASSETEVENT.TYPE)),
                        Arrays.asList(
                                row.get(ASSETEVENT.LABOURCOST),
                                row.get(ASSETEVENT.PARTSCOST),
                                row.get(ASSETEVENT.OTHERCOST)))));
        db.select(WORKORDER.ASSETID, ASSET.CATEGORY, WORKORDERCOMPLETION.LABOURCOST, WORKORDERCOMPLETION.PARTSCOST)
                .from(WORKORDERCOMPLETION)
                .join(WORKORDER)
                .on(WORKORDER.ID.eq(WORKORDERCOMPLETION.WORKORDERID))
                .join(ASSET)
                .on(ASSET.ID.eq(WORKORDER.ASSETID))
                .where(WORKORDERCOMPLETION.ESTATEID.eq(estateId))
                .forEach(row -> entries.add(new CostEntry(
                        row.get(WORKORDER.ASSETID),
                        row.get(ASSET.CATEGORY),
                        false,
                        true,
                        Arrays.asList(
                                row.get(WORKORDERCOMPLETION.LABOURCOST), row.get(WORKORDERCOMPLETION.PARTSCOST)))));
        return entries;
    }

    List<AssetRecord> activeAssets(UUID estateId) {
        return db.selectFrom(ASSET)
                .where(ASSET.ESTATEID.eq(estateId).and(ASSET.DEACTIVATEDAT.isNull()))
                .fetch();
    }

    Map<String, String> categoryLabels() {
        return db.select(ASSETCATEGORY.CODE, ASSETCATEGORY.LABEL)
                .from(ASSETCATEGORY)
                .fetchMap(ASSETCATEGORY.CODE, ASSETCATEGORY.LABEL);
    }

    /** The latest inspection date of each of the estate's inspected assets. */
    Map<UUID, LocalDate> lastInspections(UUID estateId) {
        var last = DSL.max(ASSETINSPECTIONRESULT.INSPECTEDON);
        return db.select(ASSETINSPECTIONRESULT.ASSETID, last)
                .from(ASSETINSPECTIONRESULT)
                .where(ASSETINSPECTIONRESULT.ESTATEID.eq(estateId))
                .groupBy(ASSETINSPECTIONRESULT.ASSETID)
                .fetchMap(ASSETINSPECTIONRESULT.ASSETID, last);
    }
}
