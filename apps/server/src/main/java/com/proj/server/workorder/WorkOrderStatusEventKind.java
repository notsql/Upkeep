package com.proj.server.workorder;

/** What a work-order history row records: a status change, or a change of who has the job. */
public enum WorkOrderStatusEventKind {
    STATUS,
    ASSIGNED,
    UNASSIGNED
}
