package com.proj.server.notification;

import static com.proj.server.db.tables.Estatenotificationsettings.ESTATENOTIFICATIONSETTINGS;
import static com.proj.server.db.tables.Notificationsweep.NOTIFICATIONSWEEP;

import java.time.LocalDate;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationSettingsRepository {
    private final DSLContext db;

    public NotificationSettingsRepository(DSLContext db) {
        this.db = db;
    }

    NotificationSettings find(UUID estateId) {
        return db.selectFrom(ESTATENOTIFICATIONSETTINGS)
                .where(ESTATENOTIFICATIONSETTINGS.ESTATEID.eq(estateId))
                .fetchOptional(row -> new NotificationSettings(
                        row.getAnomalyscorethreshold(), row.getServiceleaddays(), row.getRepairleaddays()))
                .orElse(NotificationSettings.DEFAULTS);
    }

    void save(UUID estateId, NotificationSettings settings, String user) {
        db.insertInto(ESTATENOTIFICATIONSETTINGS)
                .set(ESTATENOTIFICATIONSETTINGS.ESTATEID, estateId)
                .set(ESTATENOTIFICATIONSETTINGS.ANOMALYSCORETHRESHOLD, settings.anomalyScoreThreshold())
                .set(ESTATENOTIFICATIONSETTINGS.SERVICELEADDAYS, settings.serviceLeadDays())
                .set(ESTATENOTIFICATIONSETTINGS.REPAIRLEADDAYS, settings.repairLeadDays())
                .set(ESTATENOTIFICATIONSETTINGS.UPDATEDBYUSERID, user)
                .onConflict(ESTATENOTIFICATIONSETTINGS.ESTATEID)
                .doUpdate()
                .set(ESTATENOTIFICATIONSETTINGS.ANOMALYSCORETHRESHOLD, settings.anomalyScoreThreshold())
                .set(ESTATENOTIFICATIONSETTINGS.SERVICELEADDAYS, settings.serviceLeadDays())
                .set(ESTATENOTIFICATIONSETTINGS.REPAIRLEADDAYS, settings.repairLeadDays())
                .set(ESTATENOTIFICATIONSETTINGS.UPDATEDBYUSERID, user)
                .set(ESTATENOTIFICATIONSETTINGS.UPDATEDAT, DSL.currentOffsetDateTime())
                .execute();
    }

    /** Forgets that the estate was swept on this day, so the next read sweeps it again. */
    void forgetSweep(UUID estateId, LocalDate day) {
        db.deleteFrom(NOTIFICATIONSWEEP)
                .where(NOTIFICATIONSWEEP.ESTATEID.eq(estateId).and(NOTIFICATIONSWEEP.DAY.eq(day)))
                .execute();
    }
}
