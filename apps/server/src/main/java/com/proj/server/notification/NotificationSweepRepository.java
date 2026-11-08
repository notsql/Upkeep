package com.proj.server.notification;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetinspectionresult.ASSETINSPECTIONRESULT;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Notification.NOTIFICATION;
import static com.proj.server.db.tables.Notificationsweep.NOTIFICATIONSWEEP;
import static com.proj.server.db.tables.Workorder.WORKORDER;

import com.proj.server.access.AccessService;
import com.proj.server.category.EffectiveInterval;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.risk.Forecast;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/** Reads and writes for the daily sweep (spec notifications.md, "The daily sweep"). */
@Repository
public class NotificationSweepRepository {
    private static final List<String> OPEN_WORK_ORDER = List.of("OPEN", "ASSIGNED", "IN_PROGRESS");

    private final DSLContext db;

    public NotificationSweepRepository(DSLContext db) {
        this.db = db;
    }

    /** Active estates the user manages. */
    List<UUID> managedActiveEstates(String user) {
        return db.select(ESTATE.ID)
                .from(ESTATE)
                .where(AccessService.managerEstates(user).and(ESTATE.DEACTIVATEDAT.isNull()))
                .orderBy(ESTATE.ID)
                .fetch(ESTATE.ID);
    }

    /** Records the day's sweep; false when it was already swept (or is being swept) that day. */
    boolean claim(UUID estateId, LocalDate day) {
        return db.insertInto(NOTIFICATIONSWEEP, NOTIFICATIONSWEEP.ESTATEID, NOTIFICATIONSWEEP.DAY)
                        .values(estateId, day)
                        .onConflictDoNothing()
                        .execute()
                == 1;
    }

    List<AssetRecord> activeAssets(UUID estateId) {
        return db.selectFrom(ASSET)
                .where(ASSET.ESTATEID.eq(estateId).and(ASSET.DEACTIVATEDAT.isNull()))
                .fetch();
    }

    Map<UUID, LocalDate> lastInspections(UUID estateId) {
        var last = DSL.max(ASSETINSPECTIONRESULT.INSPECTEDON);
        return db.select(ASSETINSPECTIONRESULT.ASSETID, last)
                .from(ASSETINSPECTIONRESULT)
                .where(ASSETINSPECTIONRESULT.ESTATEID.eq(estateId))
                .groupBy(ASSETINSPECTIONRESULT.ASSETID)
                .fetchMap(ASSETINSPECTIONRESULT.ASSETID, last);
    }

    Set<UUID> assetsWithOpenWorkOrders(UUID estateId) {
        return new HashSet<>(db.selectDistinct(WORKORDER.ASSETID)
                .from(WORKORDER)
                .where(WORKORDER
                        .ESTATEID
                        .eq(estateId)
                        .and(WORKORDER.ASSETID.isNotNull())
                        .and(WORKORDER.STATUS.in(OPEN_WORK_ORDER)))
                .fetch(WORKORDER.ASSETID));
    }

    /** Assets of the estate with an open notification of this type. */
    Set<UUID> openAssets(UUID estateId, NotificationType type) {
        return new HashSet<>(db.select(NOTIFICATION.ASSETID)
                .from(NOTIFICATION)
                .where(NOTIFICATION
                        .ESTATEID
                        .eq(estateId)
                        .and(NOTIFICATION.TYPE.eq(type.name()))
                        .and(NOTIFICATION.RESOLVEDAT.isNull()))
                .fetch(NOTIFICATION.ASSETID));
    }

    /** Resolves the estate's open notifications of this type whose asset no longer qualifies. */
    void resolveExcept(UUID estateId, NotificationType type, Collection<UUID> qualifying) {
        db.update(NOTIFICATION)
                .set(NOTIFICATION.RESOLVEDAT, DSL.currentOffsetDateTime())
                .set(NOTIFICATION.UPDATEDAT, DSL.currentOffsetDateTime())
                .where(NOTIFICATION
                        .ESTATEID
                        .eq(estateId)
                        .and(NOTIFICATION.TYPE.eq(type.name()))
                        .and(NOTIFICATION.RESOLVEDAT.isNull())
                        .and(qualifying.isEmpty() ? DSL.trueCondition() : NOTIFICATION.ASSETID.notIn(qualifying)))
                .execute();
    }

    void insertRepairPredicted(UUID estateId, UUID assetId, String summary, Forecast forecast, double probability) {
        db.insertInto(NOTIFICATION)
                .set(NOTIFICATION.ID, UUID.randomUUID())
                .set(NOTIFICATION.ESTATEID, estateId)
                .set(NOTIFICATION.ASSETID, assetId)
                .set(NOTIFICATION.TYPE, NotificationType.REPAIR_PREDICTED.name())
                .set(NOTIFICATION.SUMMARY, summary)
                .set(
                        NOTIFICATION.RECOMMENDEDTIMEFRAME,
                        forecast.recommendedTimeframe().name())
                .set(NOTIFICATION.PROBABILITY, BigDecimal.valueOf(probability).setScale(4, RoundingMode.HALF_UP))
                .set(NOTIFICATION.BASIS, forecast.basis().name())
                .set(NOTIFICATION.FAILURESOBSERVED, forecast.failuresObserved())
                .onConflictDoNothing()
                .execute();
    }

    void insertServiceDue(UUID estateId, UUID assetId, String summary, LocalDate dueOn, EffectiveInterval interval) {
        db.insertInto(NOTIFICATION)
                .set(NOTIFICATION.ID, UUID.randomUUID())
                .set(NOTIFICATION.ESTATEID, estateId)
                .set(NOTIFICATION.ASSETID, assetId)
                .set(NOTIFICATION.TYPE, NotificationType.SERVICE_DUE.name())
                .set(NOTIFICATION.SUMMARY, summary)
                .set(NOTIFICATION.DUEON, dueOn)
                .set(NOTIFICATION.INTERVALVALUE, interval.interval().value())
                .set(NOTIFICATION.INTERVALUNIT, interval.interval().unit().name())
                .set(NOTIFICATION.INTERVALSOURCE, interval.source().name())
                .onConflictDoNothing()
                .execute();
    }
}
