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
        return ESTATEUSER.ROLE.in("COUNCIL", "MANAGER");
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

    /** Estates where the user can record inspections: owner, Manager or Crew, never a resident. */
    public static Condition inspectorEstates(String user) {
        return residentEstate(user)
                .not()
                .and(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                                .from(ESTATEUSER)
                                .where(ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.in("MANAGER", "CREW"))))));
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
                        .or(ESTATEUSER.ROLE.in("COUNCIL", "RESIDENT", "MANAGER", "CREW", "CUSTOM")))
                .orderBy(ESTATE.ID)
                .fetch();
        var capabilities = rows.map(row -> {
            // Every flag comes from the codes the user holds here (estate-role-permissions); member
            // administration and ownership stay outside the catalogue.
            var codes = EstatePermissions.effective(db, row.get(ESTATE.ID), user);
            boolean resident = "RESIDENT".equals(row.get(ESTATEUSER.ROLE));
            boolean owner = !resident && user.equals(row.get(ESTATE.OWNERUSERID));
            boolean manager = !resident && (owner || "MANAGER".equals(row.get(ESTATEUSER.ROLE)));
            boolean active = row.get(ESTATE.DEACTIVATEDAT) == null;
            boolean canViewManagement = codes.contains(EstatePermissionCode.VIEW_ESTATE);
            boolean canManageEstate = codes.contains(EstatePermissionCode.EDIT_ESTATE);
            boolean canViewAssets = codes.contains(EstatePermissionCode.VIEW_ASSETS);
            boolean canInviteMembers = active && codes.contains(EstatePermissionCode.INVITE_MEMBERS);
            boolean canManageInvitationPermissions = manager;
            boolean canViewFaultReports = codes.contains(EstatePermissionCode.VIEW_FAULT_REPORTS);
            boolean canRelocateFaultReports = active && codes.contains(EstatePermissionCode.RELOCATE_FAULT_REPORTS);
            boolean canCreateLocations = active && codes.contains(EstatePermissionCode.CREATE_LOCATIONS);
            boolean canCreateFloors = canCreateLocations;
            boolean canEditLocations = active && codes.contains(EstatePermissionCode.EDIT_LOCATIONS);
            boolean canViewEstateRoles = codes.contains(EstatePermissionCode.CREATE_ROLES)
                    || codes.contains(EstatePermissionCode.EDIT_ROLES);
            boolean canCreateRoles = active && codes.contains(EstatePermissionCode.CREATE_ROLES);
            boolean canEditRoles = active && codes.contains(EstatePermissionCode.EDIT_ROLES);
            boolean canDeleteRoles = active && manager;
            boolean canReassignRoles = active && manager;
            boolean canViewEstateInvitations = manager || codes.contains(EstatePermissionCode.INVITE_MEMBERS);
            boolean canViewDocuments = codes.contains(EstatePermissionCode.VIEW_DOCUMENTS);
            boolean canUploadDocuments = active && codes.contains(EstatePermissionCode.EDIT_DOCUMENTS);
            boolean triage = active && codes.contains(EstatePermissionCode.TRIAGE_FAULT_REPORTS);
            return new AppAccessResponse.EstateAccessResponse(
                    row.get(ESTATE.ID),
                    row.get(ESTATE.NAME),
                    resident ? "RESIDENT" : manager ? "MANAGER" : row.get(ESTATEUSER.ROLE),
                    canViewManagement,
                    canManageEstate,
                    canViewAssets,
                    canViewAssets,
                    codes.contains(EstatePermissionCode.VIEW_READINGS),
                    active && codes.contains(EstatePermissionCode.RECORD_READINGS),
                    !codes.isEmpty(),
                    codes.contains(EstatePermissionCode.VIEW_INSPECTIONS),
                    active && codes.contains(EstatePermissionCode.RECORD_INSPECTIONS),
                    canInviteMembers,
                    canManageInvitationPermissions,
                    canViewFaultReports,
                    canRelocateFaultReports,
                    codes.contains(EstatePermissionCode.VIEW_WORK_ORDERS),
                    active && codes.contains(EstatePermissionCode.MANAGE_WORK_ORDERS),
                    active && codes.contains(EstatePermissionCode.MANAGE_WORK_ORDERS),
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
                    canUploadDocuments,
                    active && codes.contains(EstatePermissionCode.IMPORT_READINGS),
                    active && codes.contains(EstatePermissionCode.IMPORT_READINGS),
                    // Matches EstateReportService: TRIAGE_FAULT_REPORTS in an active estate.
                    triage,
                    triage,
                    active && codes.contains(EstatePermissionCode.EDIT_ASSETS),
                    codes.contains(EstatePermissionCode.VIEW_COSTS),
                    codes.contains(EstatePermissionCode.VIEW_DEVICES),
                    active && codes.contains(EstatePermissionCode.MANAGE_DEVICES),
                    active && codes.contains(EstatePermissionCode.MANAGE_INSPECTIONS),
                    active && codes.contains(EstatePermissionCode.PROGRESS_ASSIGNED_WORK_ORDERS),
                    triage);
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
