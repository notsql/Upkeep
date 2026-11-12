package com.proj.server.notification;

import static com.proj.server.db.tables.Estatenotificationsettings.ESTATENOTIFICATIONSETTINGS;
import static com.proj.server.db.tables.Notification.NOTIFICATION;

import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/** WORK_ORDER_ASSIGNED notifications (work-order-assignment.md): addressed to the one member given the order. */
@Repository
public class WorkOrderNotifications {
    private final DSLContext db;

    public WorkOrderNotifications(DSLContext db) {
        this.db = db;
    }

    /** Tells the assignee; nothing when the estate switched "Work order assigned" off. */
    public void assigned(UUID estateId, UUID workOrderId, UUID assetId, String recipientUserId, String summary) {
        db.insertInto(
                        NOTIFICATION,
                        NOTIFICATION.ID,
                        NOTIFICATION.ESTATEID,
                        NOTIFICATION.ASSETID,
                        NOTIFICATION.WORKORDERID,
                        NOTIFICATION.TYPE,
                        NOTIFICATION.SUMMARY,
                        NOTIFICATION.RECIPIENTUSERID)
                .select(DSL.select(
                                DSL.val(UUID.randomUUID()),
                                DSL.val(estateId),
                                DSL.val(assetId),
                                DSL.val(workOrderId),
                                DSL.val(NotificationType.WORK_ORDER_ASSIGNED.name()),
                                DSL.val(summary),
                                DSL.val(recipientUserId))
                        .whereNotExists(DSL.selectOne()
                                .from(ESTATENOTIFICATIONSETTINGS)
                                .where(ESTATENOTIFICATIONSETTINGS
                                        .ESTATEID
                                        .eq(estateId)
                                        .and(ESTATENOTIFICATIONSETTINGS.WORKORDERASSIGNEDENABLED.isFalse()))))
                .execute();
    }

    /** Resolves the open notification of a member the order was taken from. */
    public void resolve(UUID workOrderId, String recipientUserId) {
        db.update(NOTIFICATION)
                .set(NOTIFICATION.RESOLVEDAT, DSL.currentOffsetDateTime())
                .set(NOTIFICATION.UPDATEDAT, DSL.currentOffsetDateTime())
                .where(NOTIFICATION
                        .WORKORDERID
                        .eq(workOrderId)
                        .and(NOTIFICATION.RECIPIENTUSERID.eq(recipientUserId))
                        .and(NOTIFICATION.TYPE.eq(NotificationType.WORK_ORDER_ASSIGNED.name()))
                        .and(NOTIFICATION.RESOLVEDAT.isNull()))
                .execute();
    }
}
