package com.proj.server.help;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateroledefinition.ESTATEROLEDEFINITION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import com.proj.server.estate.EstateRepository;
import com.proj.server.flatline.FlatlineService;
import com.proj.server.report.EstateReportService;
import com.proj.server.workorder.WorkOrderService;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Asks each current member's own guard, the one the action's endpoint uses, so there is no second
 * table of who may do what. The estate being inactive is not part of the answer.
 */
@Service
public class WhoCanHelpService {
    static final String OWNER = "estate owner";
    private static final List<String> PRESET_ORDER = List.of("MANAGER", "CREW", "COUNCIL", "MEMBER", "RESIDENT");
    private static final Map<String, String> PRESET_NAMES = Map.of(
            "MANAGER", "Manager", "CREW", "Crew", "COUNCIL", "Council", "MEMBER", "Member", "RESIDENT", "Resident");

    private final DSLContext db;
    private final EstateRepository estates;
    private final FlatlineService flatlines;
    private final EstateReportService reports;
    private final WorkOrderService workOrders;

    public WhoCanHelpService(
            DSLContext db,
            EstateRepository estates,
            FlatlineService flatlines,
            EstateReportService reports,
            WorkOrderService workOrders) {
        this.db = db;
        this.estates = estates;
        this.flatlines = flatlines;
        this.reports = reports;
        this.workOrders = workOrders;
    }

    record Member(String userId, String role, String customName) {}

    @Transactional(readOnly = true)
    public WhoCanHelpResponse whoCanHelp(UUID estateId, String user, HelpAction action) {
        var owner = db.select(ESTATE.OWNERUSERID)
                .from(ESTATE)
                .where(ESTATE.ID.eq(estateId))
                .fetchOptional(ESTATE.OWNERUSERID)
                .orElseThrow(WhoCanHelpService::notFound);
        var members = db.select(ESTATEUSER.USERID, ESTATEUSER.ROLE, ESTATEROLEDEFINITION.NAME)
                .from(ESTATEUSER)
                .leftJoin(ESTATEROLEDEFINITION)
                .on(ESTATEROLEDEFINITION
                        .ID
                        .eq(ESTATEUSER.CUSTOMROLEID)
                        .and(ESTATEROLEDEFINITION.ESTATEID.eq(ESTATEUSER.ESTATEID)))
                .where(ESTATEUSER.ESTATEID.eq(estateId))
                .fetch(row -> new Member(row.value1(), row.value2(), row.value3()));
        boolean member =
                owner.equals(user) || members.stream().anyMatch(m -> m.userId().equals(user));
        if (!member) {
            throw notFound();
        }
        var preset = new LinkedHashSet<String>();
        var custom = new java.util.TreeSet<String>(String.CASE_INSENSITIVE_ORDER);
        for (var m : members) {
            if (m.userId().equals(owner) || !allowed(action, estateId, m.userId())) {
                continue;
            }
            if ("CUSTOM".equals(m.role())) {
                if (m.customName() != null) custom.add(m.customName());
            } else if (PRESET_NAMES.containsKey(m.role())) {
                preset.add(m.role());
            }
        }
        var roles = new ArrayList<String>();
        PRESET_ORDER.stream().filter(preset::contains).map(PRESET_NAMES::get).forEach(roles::add);
        roles.addAll(custom);
        if (allowed(action, estateId, owner)) {
            roles.add(OWNER);
        }
        return new WhoCanHelpResponse(action, roles);
    }

    private boolean allowed(HelpAction action, UUID estateId, String user) {
        try {
            return switch (action) {
                // DeviceService and AssetAssessmentService guard with findOwned.
                case REPLACE_SENSOR, GENERATE_CONNECTION_KEY, RECORD_CONDITION ->
                    estates.findOwned(estateId, user, false).isPresent();
                case PAUSE_SENSOR_WARNINGS -> flatlines.canPause(estateId, user);
                // Notification visibility and the inspection list both use managerEstates via findManaged.
                case ACKNOWLEDGE_ALERT, SEND_CREW ->
                    estates.findManaged(estateId, user).isPresent();
                case REVIEW_DUPLICATE -> reports.canReviewDuplicates(estateId, user);
                case SEND_CONTRACTOR -> workOrders.canCreate(estateId, user);
            };
        } catch (ResponseStatusException refused) {
            return false;
        }
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Estate not found.");
    }
}
