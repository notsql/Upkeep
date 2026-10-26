package com.proj.server.access;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateroledefinition.ESTATEROLEDEFINITION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.resident.ResidentContextResponse;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;

/** Estate membership is checked against current database rows, never a JWT resident claim. */
@Service
public class AccessService {
    private final DSLContext db;

    public AccessService(DSLContext db) {
        this.db = db;
    }

    public static Condition managementMembership() {
        return ESTATEUSER.ROLE.in("MEMBER", "COUNCIL", "MANAGER");
    }

    public static Condition managerEstates(String user) {
        return residentEstate(user)
                .not()
                .and(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                                .from(ESTATEUSER)
                                .where(ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("MANAGER"))))));
    }

    public static Condition residentEstate(String user) {
        return ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                .from(ESTATEUSER)
                .where(ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("RESIDENT"))));
    }

    public static Condition managementEstates(String user) {
        return residentEstate(user)
                .not()
                .and(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                                .from(ESTATEUSER)
                                .where(ESTATEUSER.USERID.eq(user).and(managementMembership()))))
                        .or(EstatePermissions.customEstates(user, EstatePermissionCode.VIEW_ESTATE)));
    }

    public AppAccessResponse context(String user, boolean admin) {
        var rows = db.select(
                        ESTATE.ID,
                        ESTATE.NAME,
                        ESTATE.OWNERUSERID,
                        ESTATE.DEACTIVATEDAT,
                        ESTATEUSER.ROLE,
                        ESTATEUSER.CANINVITEMEMBERS,
                        ESTATEUSER.CUSTOMROLEID,
                        ESTATEROLEDEFINITION.NAME)
                .from(ESTATE)
                .leftJoin(ESTATEUSER)
                .on(ESTATEUSER.ESTATEID.eq(ESTATE.ID).and(ESTATEUSER.USERID.eq(user)))
                .leftJoin(ESTATEROLEDEFINITION)
                .on(ESTATEROLEDEFINITION
                        .ID
                        .eq(ESTATEUSER.CUSTOMROLEID)
                        .and(ESTATEROLEDEFINITION.ESTATEID.eq(ESTATE.ID)))
                .where(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATEUSER.ROLE.in("MEMBER", "COUNCIL", "RESIDENT", "MANAGER", "CREW", "CUSTOM")))
                .orderBy(ESTATE.ID)
                .fetch();
        var capabilities = rows.map(row -> {
            boolean custom = "CUSTOM".equals(row.get(ESTATEUSER.ROLE));
            var permissions = custom
                    ? EstatePermissions.grants(db, row.get(ESTATEUSER.CUSTOMROLEID), row.get(ESTATE.ID))
                    : java.util.Set.<EstatePermissionCode>of();
            boolean resident = "RESIDENT".equals(row.get(ESTATEUSER.ROLE));
            boolean owner = !resident && user.equals(row.get(ESTATE.OWNERUSERID));
            boolean manager = !resident && (owner || "MANAGER".equals(row.get(ESTATEUSER.ROLE)));
            boolean management = !resident
                    && (owner
                            || manager
                            || "MEMBER".equals(row.get(ESTATEUSER.ROLE))
                            || "COUNCIL".equals(row.get(ESTATEUSER.ROLE)));
            boolean active = row.get(ESTATE.DEACTIVATEDAT) == null;
            boolean responder = "MANAGER".equals(row.get(ESTATEUSER.ROLE)) || "CREW".equals(row.get(ESTATEUSER.ROLE));
            boolean canViewManagement = management || permissions.contains(EstatePermissionCode.VIEW_ESTATE);
            boolean canManageEstate = manager || permissions.contains(EstatePermissionCode.EDIT_ESTATE);
            boolean canViewAssets = owner;
            boolean canInviteMembers = active && (manager || permissions.contains(EstatePermissionCode.INVITE_MEMBERS));
            boolean canManageInvitationPermissions = manager;
            boolean canViewFaultReports = responder || permissions.contains(EstatePermissionCode.VIEW_FAULT_REPORTS);
            boolean canRelocateFaultReports =
                    active && (responder || permissions.contains(EstatePermissionCode.RELOCATE_FAULT_REPORTS));
            boolean canCreateLocations =
                    active && (manager || permissions.contains(EstatePermissionCode.CREATE_LOCATIONS));
            boolean canCreateFloors = active && (owner || permissions.contains(EstatePermissionCode.CREATE_LOCATIONS));
            boolean canEditLocations = active && (owner || permissions.contains(EstatePermissionCode.EDIT_LOCATIONS));
            boolean canViewEstateRoles = manager
                    || permissions.contains(EstatePermissionCode.CREATE_ROLES)
                    || permissions.contains(EstatePermissionCode.EDIT_ROLES);
            boolean canCreateRoles = active && (manager || permissions.contains(EstatePermissionCode.CREATE_ROLES));
            boolean canEditRoles = active && (manager || permissions.contains(EstatePermissionCode.EDIT_ROLES));
            boolean canDeleteRoles = active && manager;
            boolean canReassignRoles = active && manager;
            boolean canViewEstateInvitations = manager || permissions.contains(EstatePermissionCode.INVITE_MEMBERS);
            boolean presetDocuments =
                    manager || "COUNCIL".equals(row.get(ESTATEUSER.ROLE)) || "CREW".equals(row.get(ESTATEUSER.ROLE));
            boolean canViewDocuments = presetDocuments || permissions.contains(EstatePermissionCode.VIEW_DOCUMENTS);
            boolean canUploadDocuments =
                    active && (presetDocuments || permissions.contains(EstatePermissionCode.EDIT_DOCUMENTS));
            return new AppAccessResponse.EstateAccessResponse(
                    row.get(ESTATE.ID),
                    row.get(ESTATE.NAME),
                    resident ? "RESIDENT" : manager ? "MANAGER" : row.get(ESTATEUSER.ROLE),
                    canViewManagement,
                    canManageEstate,
                    canViewAssets,
                    canInviteMembers,
                    canManageInvitationPermissions,
                    canViewFaultReports,
                    canRelocateFaultReports,
                    !resident && (manager || "CREW".equals(row.get(ESTATEUSER.ROLE))),
                    manager && active,
                    manager && active,
                    row.get(ESTATEUSER.CUSTOMROLEID),
                    row.get(ESTATEROLEDEFINITION.NAME),
                    canCreateLocations,
                    canCreateFloors,
                    canEditLocations,
                    canViewEstateRoles,
                    canCreateRoles,
                    canEditRoles,
                    canDeleteRoles,
                    canReassignRoles,
                    canViewEstateInvitations,
                    canViewDocuments,
                    canUploadDocuments);
        });
        var assigned = rows.stream()
                .filter(row -> "RESIDENT".equals(row.get(ESTATEUSER.ROLE)) && row.get(ESTATE.DEACTIVATEDAT) == null)
                .map(row -> new ResidentContextResponse.EstateLabel(row.get(ESTATE.ID), row.get(ESTATE.NAME)))
                .toList();
        boolean manager = capabilities.stream().anyMatch(AppAccessResponse.EstateAccessResponse::canManageEstate);
        boolean workspace = manager
                || capabilities.stream()
                        .anyMatch(estate -> estate.canViewManagement()
                                || estate.canViewFaultReports()
                                || estate.canViewWorkOrders()
                                || estate.canViewEstateRoles()
                                || estate.canViewEstateInvitations()
                                || estate.canViewDocuments());
        return new AppAccessResponse(
                workspace,
                true,
                false,
                capabilities.stream().anyMatch(estate -> "RESIDENT".equals(estate.role())),
                !assigned.isEmpty(),
                assigned,
                capabilities);
    }

    public boolean hasResidentMembership(String user) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("RESIDENT")));
    }
}
