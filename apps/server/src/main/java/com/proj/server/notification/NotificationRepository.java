package com.proj.server.notification;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Notification.NOTIFICATION;
import static com.proj.server.db.tables.Notificationread.NOTIFICATIONREAD;

import com.proj.server.access.AccessService;
import com.proj.server.asset.AssetCondition;
import com.proj.server.category.IntervalSource;
import com.proj.server.category.ServiceInterval;
import com.proj.server.risk.FailureRiskBasis;
import com.proj.server.risk.RecommendedTimeframe;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/** Notifications are estate rows; read receipts are per user (spec notifications.md, Decision 2). */
@Repository
public class NotificationRepository {
    private final DSLContext db;

    public NotificationRepository(DSLContext db) {
        this.db = db;
    }

    /** Notifications of the estates the user manages, decided at read time. */
    static Condition visibleTo(String user) {
        return NOTIFICATION.ESTATEID.in(DSL.select(ESTATE.ID).from(ESTATE).where(AccessService.managerEstates(user)));
    }

    private static Condition readBy(String user) {
        return DSL.exists(DSL.selectOne()
                .from(NOTIFICATIONREAD)
                .where(NOTIFICATIONREAD.NOTIFICATIONID.eq(NOTIFICATION.ID).and(NOTIFICATIONREAD.USERID.eq(user))));
    }

    int unread(String user) {
        return db.fetchCount(NOTIFICATION, visibleTo(user).and(DSL.not(readBy(user))));
    }

    long total(String user) {
        return db.fetchCount(NOTIFICATION, visibleTo(user));
    }

    List<NotificationResponse> page(String user, int page, int size) {
        return select(user)
                .where(visibleTo(user))
                .orderBy(NOTIFICATION.CREATEDAT.desc(), NOTIFICATION.ID.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(record -> map(record, user));
    }

    boolean visible(UUID id, String user) {
        return db.fetchExists(NOTIFICATION, NOTIFICATION.ID.eq(id).and(visibleTo(user)));
    }

    void markRead(UUID id, String user) {
        db.insertInto(NOTIFICATIONREAD, NOTIFICATIONREAD.NOTIFICATIONID, NOTIFICATIONREAD.USERID)
                .values(id, user)
                .onConflictDoNothing()
                .execute();
    }

    /** Marks read every visible notification created up to the start of this transaction. */
    void markAllRead(String user) {
        db.insertInto(NOTIFICATIONREAD, NOTIFICATIONREAD.NOTIFICATIONID, NOTIFICATIONREAD.USERID)
                .select(DSL.select(NOTIFICATION.ID, DSL.val(user))
                        .from(NOTIFICATION)
                        .where(visibleTo(user)
                                .and(NOTIFICATION.CREATEDAT.le(DSL.currentOffsetDateTime()))
                                .and(DSL.not(readBy(user)))))
                .onConflictDoNothing()
                .execute();
    }

    /** The caller's view of one notification, if they can see it. */
    Optional<NotificationResponse> one(UUID id, String user) {
        return select(user)
                .where(NOTIFICATION.ID.eq(id).and(visibleTo(user)))
                .fetchOptional(record -> map(record, user));
    }

    /** An asset's anomaly alerts, newest first. */
    List<NotificationResponse> anomalyAlerts(UUID assetId, String user) {
        return select(user)
                .where(NOTIFICATION.ASSETID.eq(assetId).and(NOTIFICATION.TYPE.eq(NotificationType.ANOMALY.name())))
                .orderBy(NOTIFICATION.CREATEDAT.desc(), NOTIFICATION.ID.desc())
                .fetch(record -> map(record, user));
    }

    /** What deciding a response needs, with the notification row locked. */
    record ResponseTarget(
            NotificationType type, AlertResponse response, boolean assetRetired, boolean estateInactive) {}

    Optional<ResponseTarget> lockForResponse(UUID id, String user) {
        return db.select(NOTIFICATION.TYPE, NOTIFICATION.RESPONSE, ASSET.DEACTIVATEDAT, ESTATE.DEACTIVATEDAT)
                .from(NOTIFICATION)
                .join(ESTATE)
                .on(ESTATE.ID.eq(NOTIFICATION.ESTATEID))
                .join(ASSET)
                .on(ASSET.ID.eq(NOTIFICATION.ASSETID))
                .where(NOTIFICATION.ID.eq(id).and(visibleTo(user)))
                .forUpdate()
                .of(NOTIFICATION)
                .fetchOptional(row -> new ResponseTarget(
                        NotificationType.valueOf(row.get(NOTIFICATION.TYPE)),
                        row.get(NOTIFICATION.RESPONSE) == null
                                ? null
                                : AlertResponse.valueOf(row.get(NOTIFICATION.RESPONSE)),
                        row.get(ASSET.DEACTIVATEDAT) != null,
                        row.get(ESTATE.DEACTIVATEDAT) != null));
    }

    void respond(UUID id, AlertResponse response, String user, String name, String reason) {
        db.update(NOTIFICATION)
                .set(NOTIFICATION.RESPONSE, response.name())
                .set(NOTIFICATION.RESPONDEDBYUSERID, user)
                .set(NOTIFICATION.RESPONDEDBYNAME, name)
                .set(NOTIFICATION.RESPONDEDAT, DSL.currentOffsetDateTime())
                .set(NOTIFICATION.RESPONSEREASON, reason)
                .set(NOTIFICATION.UPDATEDAT, DSL.currentOffsetDateTime())
                .where(NOTIFICATION.ID.eq(id))
                .execute();
    }

    /** Locks the asset's open notification of this type, if any. */
    Optional<UUID> lockOpen(UUID assetId, NotificationType type) {
        return db.select(NOTIFICATION.ID)
                .from(NOTIFICATION)
                .where(NOTIFICATION
                        .ASSETID
                        .eq(assetId)
                        .and(NOTIFICATION.TYPE.eq(type.name()))
                        .and(NOTIFICATION.RESOLVEDAT.isNull()))
                .forUpdate()
                .fetchOptional(NOTIFICATION.ID);
    }

    void resolveOpen(UUID assetId, NotificationType type) {
        db.update(NOTIFICATION)
                .set(NOTIFICATION.RESOLVEDAT, DSL.currentOffsetDateTime())
                .set(NOTIFICATION.UPDATEDAT, DSL.currentOffsetDateTime())
                .where(NOTIFICATION
                        .ASSETID
                        .eq(assetId)
                        .and(NOTIFICATION.TYPE.eq(type.name()))
                        .and(NOTIFICATION.RESOLVEDAT.isNull()))
                .execute();
    }

    /** False when another open anomaly alert for the asset won the race (partial unique index). */
    boolean insertAnomaly(UUID estateId, UUID assetId, String summary, AbnormalRun run) {
        return db.insertInto(NOTIFICATION)
                        .set(NOTIFICATION.ID, UUID.randomUUID())
                        .set(NOTIFICATION.ESTATEID, estateId)
                        .set(NOTIFICATION.ASSETID, assetId)
                        .set(NOTIFICATION.TYPE, NotificationType.ANOMALY.name())
                        .set(NOTIFICATION.SUMMARY, summary)
                        .set(NOTIFICATION.CONDITION, run.condition().name())
                        .set(NOTIFICATION.MEDIANSCORE, score(run.medianScore()))
                        .set(NOTIFICATION.MAXSCORE, score(run.maxScore()))
                        .set(NOTIFICATION.FIRSTDETECTEDAT, utc(run.from()))
                        .set(NOTIFICATION.LASTDETECTEDAT, utc(run.to()))
                        .set(NOTIFICATION.EXPLANATION, run.explanation())
                        .set(NOTIFICATION.RESPONSE, AlertResponse.NONE.name())
                        .onConflictDoNothing()
                        .execute()
                == 1;
    }

    /** Latest scores and explanation; the first-detected and creation times stay, last-detected only moves forward. */
    void updateAnomaly(UUID id, String summary, AbnormalRun run) {
        db.update(NOTIFICATION)
                .set(NOTIFICATION.SUMMARY, summary)
                .set(NOTIFICATION.CONDITION, run.condition().name())
                .set(NOTIFICATION.MEDIANSCORE, score(run.medianScore()))
                .set(NOTIFICATION.MAXSCORE, score(run.maxScore()))
                .set(NOTIFICATION.EXPLANATION, run.explanation())
                .set(NOTIFICATION.LASTDETECTEDAT, DSL.greatest(NOTIFICATION.LASTDETECTEDAT, DSL.val(utc(run.to()))))
                .set(NOTIFICATION.UPDATEDAT, DSL.currentOffsetDateTime())
                .where(NOTIFICATION.ID.eq(id))
                .execute();
    }

    private static BigDecimal score(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }

    private org.jooq.SelectOnConditionStep<Record> select(String user) {
        return db.select(NOTIFICATION.fields())
                .select(
                        ESTATE.NAME,
                        ASSET.REFERENCE,
                        ASSET.NAME,
                        DSL.field(readBy(user)).as("read"))
                .from(NOTIFICATION)
                .join(ESTATE)
                .on(ESTATE.ID.eq(NOTIFICATION.ESTATEID))
                .join(ASSET)
                .on(ASSET.ID.eq(NOTIFICATION.ASSETID));
    }

    private static NotificationResponse map(Record r, String user) {
        var n = r.into(NOTIFICATION);
        var type = NotificationType.valueOf(n.getType());
        return new NotificationResponse(
                n.getId(),
                type,
                n.getEstateid(),
                r.get(ESTATE.NAME),
                n.getAssetid(),
                r.get(ASSET.REFERENCE),
                r.get(ASSET.NAME),
                n.getSummary(),
                n.getCreatedat(),
                n.getUpdatedat(),
                n.getResolvedat(),
                Boolean.TRUE.equals(r.get("read", Boolean.class)),
                type == NotificationType.ANOMALY
                        ? new NotificationResponse.Anomaly(
                                AssetCondition.valueOf(n.getCondition()),
                                number(n.getMedianscore()),
                                number(n.getMaxscore()),
                                n.getFirstdetectedat(),
                                n.getLastdetectedat(),
                                n.getExplanation(),
                                AlertResponse.valueOf(n.getResponse()),
                                n.getRespondedbyname(),
                                n.getRespondedat(),
                                n.getResponsereason())
                        : null,
                type == NotificationType.SERVICE_DUE
                        ? new NotificationResponse.ServiceDue(
                                n.getDueon(),
                                ServiceInterval.of(n.getIntervalvalue(), n.getIntervalunit()),
                                IntervalSource.valueOf(n.getIntervalsource()))
                        : null,
                type == NotificationType.REPAIR_PREDICTED
                        ? new NotificationResponse.RepairPredicted(
                                RecommendedTimeframe.valueOf(n.getRecommendedtimeframe()),
                                number(n.getProbability()),
                                FailureRiskBasis.valueOf(n.getBasis()),
                                n.getFailuresobserved())
                        : null);
    }

    private static double number(BigDecimal value) {
        return value.doubleValue();
    }
}
