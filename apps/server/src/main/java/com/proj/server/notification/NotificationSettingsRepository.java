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
                        row.getAnomalyenabled(),
                        row.getServicedueenabled(),
                        row.getRepairpredictedenabled(),
                        row.getCheckrequestedenabled(),
                        row.getCheckfailedenabled()))
                .orElse(NotificationSettings.DEFAULTS);
    }

    void save(UUID estateId, NotificationSettings settings, String user) {
        db.insertInto(ESTATENOTIFICATIONSETTINGS)
                .set(ESTATENOTIFICATIONSETTINGS.ESTATEID, estateId)
                .set(ESTATENOTIFICATIONSETTINGS.ANOMALYENABLED, settings.anomalyEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.SERVICEDUEENABLED, settings.serviceDueEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.REPAIRPREDICTEDENABLED, settings.repairPredictedEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.CHECKREQUESTEDENABLED, settings.checkRequestedEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.CHECKFAILEDENABLED, settings.checkFailedEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.UPDATEDBYUSERID, user)
                .onConflict(ESTATENOTIFICATIONSETTINGS.ESTATEID)
                .doUpdate()
                .set(ESTATENOTIFICATIONSETTINGS.ANOMALYENABLED, settings.anomalyEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.SERVICEDUEENABLED, settings.serviceDueEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.REPAIRPREDICTEDENABLED, settings.repairPredictedEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.CHECKREQUESTEDENABLED, settings.checkRequestedEnabled())
                .set(ESTATENOTIFICATIONSETTINGS.CHECKFAILEDENABLED, settings.checkFailedEnabled())
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
