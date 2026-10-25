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
    EDIT_ROLES;

    public List<EstatePermissionCode> requires() {
        return switch (this) {
            case EDIT_ESTATE, CREATE_LOCATIONS, EDIT_LOCATIONS -> List.of(VIEW_ESTATE);
            case RELOCATE_FAULT_REPORTS -> List.of(VIEW_FAULT_REPORTS);
            default -> List.of();
        };
    }
}
