package com.proj.server.estate;

import java.util.List;

/** Stable application operations; catalogue rows alone never create authority. */
public enum EstatePermissionCode {
    VIEW_ESTATE,
    EDIT_ESTATE,
    VIEW_FAULT_REPORTS,
    RELOCATE_FAULT_REPORTS,
    INVITE_MEMBERS,
    CREATE_LOCATIONS,
    EDIT_LOCATIONS,
    CREATE_ROLES,
    EDIT_ROLES,
    VIEW_DOCUMENTS,
    EDIT_DOCUMENTS,
    TRIAGE_FAULT_REPORTS,
    VIEW_WORK_ORDERS,
    PROGRESS_ASSIGNED_WORK_ORDERS,
    MANAGE_WORK_ORDERS,
    VIEW_ASSETS,
    EDIT_ASSETS,
    VIEW_COSTS,
    VIEW_READINGS,
    RECORD_READINGS,
    IMPORT_READINGS,
    VIEW_DEVICES,
    MANAGE_DEVICES,
    VIEW_INSPECTIONS,
    RECORD_INSPECTIONS,
    MANAGE_INSPECTIONS;

    public List<EstatePermissionCode> requires() {
        return switch (this) {
            case EDIT_ESTATE, CREATE_LOCATIONS, EDIT_LOCATIONS -> List.of(VIEW_ESTATE);
            case RELOCATE_FAULT_REPORTS, TRIAGE_FAULT_REPORTS -> List.of(VIEW_FAULT_REPORTS);
            case EDIT_DOCUMENTS -> List.of(VIEW_DOCUMENTS);
            case PROGRESS_ASSIGNED_WORK_ORDERS, MANAGE_WORK_ORDERS -> List.of(VIEW_WORK_ORDERS);
            case EDIT_ASSETS, VIEW_COSTS -> List.of(VIEW_ASSETS);
            case RECORD_READINGS, IMPORT_READINGS -> List.of(VIEW_READINGS);
            case MANAGE_DEVICES -> List.of(VIEW_DEVICES);
            case RECORD_INSPECTIONS, MANAGE_INSPECTIONS -> List.of(VIEW_INSPECTIONS);
            default -> List.of();
        };
    }
}
