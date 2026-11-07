package com.proj.server.inspectionlist;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetinspectionresult.ASSETINSPECTIONRESULT;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Inspectioncheck.INSPECTIONCHECK;
import static com.proj.server.db.tables.Inspectionlistrun.INSPECTIONLISTRUN;
import static com.proj.server.db.tables.Location.LOCATION;

import com.proj.server.category.IntervalSource;
import com.proj.server.category.ServiceInterval;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AssetinspectionresultRecord;
import com.proj.server.db.tables.records.InspectioncheckRecord;
import com.proj.server.db.tables.records.InspectionlistrunRecord;
import com.proj.server.db.tables.records.LocationRecord;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/** Checks are inserted, then completed once; list runs are append-only. */
@Repository
public class InspectionListRepository {
    private final DSLContext db;

    public InspectionListRepository(DSLContext db) {
        this.db = db;
    }

    /** Serialises generation with itself and with recording results (ID-85 locks the estate too). */
    void lockEstate(UUID estateId) {
        db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId)).forUpdate().fetchOne();
    }

    /** Active assets of the estate in the given categories. */
    List<AssetRecord> eligibleAssets(UUID estateId, Set<String> categories) {
        return db.selectFrom(ASSET)
                .where(ASSET.ESTATEID
                        .eq(estateId)
                        .and(ASSET.DEACTIVATEDAT.isNull())
                        .and(ASSET.CATEGORY.in(categories)))
                .fetch();
    }

    List<AssetRecord> assets(Collection<UUID> ids) {
        return db.selectFrom(ASSET).where(ASSET.ID.in(ids)).fetch();
    }

    /** The latest inspection date of each of the estate's assets that has one. */
    Map<UUID, LocalDate> lastInspections(UUID estateId) {
        var last = DSL.max(ASSETINSPECTIONRESULT.INSPECTEDON);
        return db.select(ASSETINSPECTIONRESULT.ASSETID, last)
                .from(ASSETINSPECTIONRESULT)
                .where(ASSETINSPECTIONRESULT.ESTATEID.eq(estateId))
                .groupBy(ASSETINSPECTIONRESULT.ASSETID)
                .fetchMap(ASSETINSPECTIONRESULT.ASSETID, last);
    }

    Map<UUID, LocationRecord> locations(UUID estateId) {
        return db.selectFrom(LOCATION).where(LOCATION.ESTATEID.eq(estateId)).fetchMap(LOCATION.ID);
    }

    /** Open checks, plus every check of the month, of the estate's active assets. */
    List<InspectioncheckRecord> listed(UUID estateId, LocalDate month) {
        return db.select(INSPECTIONCHECK.fields())
                .from(INSPECTIONCHECK)
                .join(ASSET)
                .on(ASSET.ID.eq(INSPECTIONCHECK.ASSETID))
                .where(INSPECTIONCHECK
                        .ESTATEID
                        .eq(estateId)
                        .and(ASSET.DEACTIVATEDAT.isNull())
                        .and(INSPECTIONCHECK.COMPLETEDBYRESULTID.isNull().or(INSPECTIONCHECK.MONTH.eq(month))))
                .fetchInto(InspectioncheckRecord.class);
    }

    /** Assets that already have an open check, or any check for the month. */
    Set<UUID> checked(UUID estateId, LocalDate month) {
        return db.selectDistinct(INSPECTIONCHECK.ASSETID)
                .from(INSPECTIONCHECK)
                .where(INSPECTIONCHECK
                        .ESTATEID
                        .eq(estateId)
                        .and(INSPECTIONCHECK.COMPLETEDBYRESULTID.isNull().or(INSPECTIONCHECK.MONTH.eq(month))))
                .fetchSet(INSPECTIONCHECK.ASSETID);
    }

    Map<UUID, AssetinspectionresultRecord> results(Collection<UUID> ids) {
        return db.selectFrom(ASSETINSPECTIONRESULT)
                .where(ASSETINSPECTIONRESULT.ID.in(ids))
                .fetchMap(ASSETINSPECTIONRESULT.ID);
    }

    void insertCheck(
            UUID estateId,
            UUID assetId,
            LocalDate month,
            DueDates.Due due,
            ServiceInterval interval,
            IntervalSource source,
            String userId,
            String name,
            OffsetDateTime at) {
        db.insertInto(INSPECTIONCHECK)
                .set(INSPECTIONCHECK.ID, UUID.randomUUID())
                .set(INSPECTIONCHECK.ESTATEID, estateId)
                .set(INSPECTIONCHECK.ASSETID, assetId)
                .set(INSPECTIONCHECK.MONTH, month)
                .set(INSPECTIONCHECK.DUEON, due.dueOn())
                .set(INSPECTIONCHECK.DUEBASIS, due.basis().name())
                .set(INSPECTIONCHECK.INTERVALVALUE, interval == null ? null : interval.value())
                .set(
                        INSPECTIONCHECK.INTERVALUNIT,
                        interval == null ? null : interval.unit().name())
                .set(INSPECTIONCHECK.INTERVALSOURCE, interval == null ? null : source.name())
                .set(INSPECTIONCHECK.GENERATEDBYUSERID, userId)
                .set(INSPECTIONCHECK.GENERATEDBYNAME, name)
                .set(INSPECTIONCHECK.GENERATEDAT, at)
                .execute();
    }

    void insertRun(UUID estateId, LocalDate month, int added, String userId, String name, OffsetDateTime at) {
        db.insertInto(INSPECTIONLISTRUN)
                .set(INSPECTIONLISTRUN.ID, UUID.randomUUID())
                .set(INSPECTIONLISTRUN.ESTATEID, estateId)
                .set(INSPECTIONLISTRUN.MONTH, month)
                .set(INSPECTIONLISTRUN.ADDED, added)
                .set(INSPECTIONLISTRUN.GENERATEDBYUSERID, userId)
                .set(INSPECTIONLISTRUN.GENERATEDBYNAME, name)
                .set(INSPECTIONLISTRUN.GENERATEDAT, at)
                .execute();
    }

    Optional<InspectionlistrunRecord> latestRun(UUID estateId, LocalDate month) {
        return db.selectFrom(INSPECTIONLISTRUN)
                .where(INSPECTIONLISTRUN.ESTATEID.eq(estateId).and(INSPECTIONLISTRUN.MONTH.eq(month)))
                .orderBy(INSPECTIONLISTRUN.GENERATEDAT.desc(), INSPECTIONLISTRUN.ID.desc())
                .limit(1)
                .fetchOptional();
    }

    /** Completes the asset's open check, if any, with the result just recorded (ID-85). */
    public void complete(UUID assetId, UUID resultId) {
        db.update(INSPECTIONCHECK)
                .set(INSPECTIONCHECK.COMPLETEDBYRESULTID, resultId)
                .set(INSPECTIONCHECK.COMPLETEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .where(INSPECTIONCHECK.ASSETID.eq(assetId).and(INSPECTIONCHECK.COMPLETEDBYRESULTID.isNull()))
                .execute();
    }
}
