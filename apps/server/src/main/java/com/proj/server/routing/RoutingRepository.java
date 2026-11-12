package com.proj.server.routing;

import static com.proj.server.db.tables.Equipmentproviderroute.EQUIPMENTPROVIDERROUTE;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Issuereportimage.ISSUEREPORTIMAGE;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Reportclassification.REPORTCLASSIFICATION;
import static com.proj.server.db.tables.Reportrouting.REPORTROUTING;
import static com.proj.server.db.tables.Serviceprovider.SERVICEPROVIDER;
import static com.proj.server.db.tables.Workorder.WORKORDER;
import static com.proj.server.db.tables.Workorderdispatch.WORKORDERDISPATCH;
import static org.jooq.impl.DSL.concatWs;
import static org.jooq.impl.DSL.currentOffsetDateTime;

import com.proj.server.db.tables.Location;
import com.proj.server.workorder.WorkOrderStatus;
import com.proj.server.workos.WorkOSService;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.springframework.stereotype.Repository;

@Repository
public class RoutingRepository {
    private static final Location PARENT = LOCATION.as("parent");
    private static final Location GRANDPARENT = LOCATION.as("grandparent");
    private static final Field<String> LOCATION_LABEL = concatWs(" › ", GRANDPARENT.NAME, PARENT.NAME, LOCATION.NAME);

    private final DSLContext db;
    private final WorkOSService workOS;

    public RoutingRepository(DSLContext db, WorkOSService workOS) {
        this.db = db;
        this.workOS = workOS;
    }

    /** Locks the estate row first, matching the order every work-order write uses. */
    public void lockEstate(UUID estateId) {
        db.select(ESTATE.ID)
                .from(ESTATE)
                .where(ESTATE.ID.eq(estateId))
                .forUpdate()
                .fetch();
    }

    // --- Providers and their equipment routes --------------------------------------------------------------------

    public record Contractor(
            UUID providerId, EquipmentType equipmentType, String name, String email, OffsetDateTime updatedAt) {}

    /** The routed provider for each equipment type, in equipment-type order. */
    public Map<EquipmentType, Contractor> contractors(UUID estateId) {
        var found = new EnumMap<EquipmentType, Contractor>(EquipmentType.class);
        db.select(
                        EQUIPMENTPROVIDERROUTE.EQUIPMENTTYPE,
                        SERVICEPROVIDER.ID,
                        SERVICEPROVIDER.NAME,
                        SERVICEPROVIDER.EMAIL,
                        SERVICEPROVIDER.UPDATEDAT)
                .from(EQUIPMENTPROVIDERROUTE)
                .join(SERVICEPROVIDER)
                .on(SERVICEPROVIDER.ID.eq(EQUIPMENTPROVIDERROUTE.PROVIDERID))
                .where(EQUIPMENTPROVIDERROUTE.ESTATEID.eq(estateId))
                .forShare()
                .of(EQUIPMENTPROVIDERROUTE)
                .fetch()
                .forEach(row -> {
                    var type = EquipmentType.valueOf(row.value1());
                    found.put(type, new Contractor(row.value2(), type, row.value3(), row.value4(), row.value5()));
                });
        return found;
    }

    // --- The contractor directory (work-order-assignment.md) ---------------------------------------------------------

    public record DirectoryEntry(UUID id, String name, String email, List<EquipmentType> defaultFor) {}

    /** Every contractor in the estate's directory, by name, with the equipment types it is the default for. */
    public List<DirectoryEntry> directory(UUID estateId) {
        var defaults = new HashMap<UUID, List<EquipmentType>>();
        db.select(EQUIPMENTPROVIDERROUTE.PROVIDERID, EQUIPMENTPROVIDERROUTE.EQUIPMENTTYPE)
                .from(EQUIPMENTPROVIDERROUTE)
                .where(EQUIPMENTPROVIDERROUTE.ESTATEID.eq(estateId))
                .fetch()
                .forEach(row -> defaults.computeIfAbsent(row.value1(), id -> new java.util.ArrayList<>())
                        .add(EquipmentType.valueOf(row.value2())));
        defaults.values().forEach(types -> types.sort(null));
        return db.select(SERVICEPROVIDER.ID, SERVICEPROVIDER.NAME, SERVICEPROVIDER.EMAIL)
                .from(SERVICEPROVIDER)
                .where(SERVICEPROVIDER.ESTATEID.eq(estateId))
                .orderBy(SERVICEPROVIDER.NAME, SERVICEPROVIDER.ID)
                .fetch(row -> new DirectoryEntry(
                        row.value1(),
                        row.value2(),
                        row.value3(),
                        List.copyOf(defaults.getOrDefault(row.value1(), List.of()))));
    }

    public Optional<DirectoryEntry> directoryEntry(UUID estateId, UUID id) {
        return directory(estateId).stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    public boolean emailTaken(UUID estateId, String email, UUID except) {
        var condition = SERVICEPROVIDER.ESTATEID.eq(estateId).and(SERVICEPROVIDER.EMAIL.equalIgnoreCase(email));
        if (except != null) condition = condition.and(SERVICEPROVIDER.ID.ne(except));
        return db.fetchExists(SERVICEPROVIDER, condition);
    }

    public UUID addContractor(UUID estateId, String name, String email) {
        var id = UUID.randomUUID();
        db.insertInto(SERVICEPROVIDER)
                .set(SERVICEPROVIDER.ID, id)
                .set(SERVICEPROVIDER.ESTATEID, estateId)
                .set(SERVICEPROVIDER.NAME, name)
                .set(SERVICEPROVIDER.EMAIL, email)
                .set(SERVICEPROVIDER.UPDATEDAT, currentOffsetDateTime())
                .execute();
        return id;
    }

    /** False when the contractor is not in this estate's directory. */
    public boolean editContractor(UUID estateId, UUID id, String name, String email) {
        return db.update(SERVICEPROVIDER)
                        .set(SERVICEPROVIDER.NAME, name)
                        .set(SERVICEPROVIDER.EMAIL, email)
                        .set(SERVICEPROVIDER.UPDATEDAT, currentOffsetDateTime())
                        .where(SERVICEPROVIDER.ID.eq(id).and(SERVICEPROVIDER.ESTATEID.eq(estateId)))
                        .execute()
                == 1;
    }

    /** Orders not yet closed that this contractor has. */
    public int openAssignments(UUID estateId, UUID providerId) {
        return db.fetchCount(
                WORKORDER,
                WORKORDER
                        .ESTATEID
                        .eq(estateId)
                        .and(WORKORDER.ASSIGNEEPROVIDERID.eq(providerId))
                        .and(WORKORDER.STATUS.ne(WorkOrderStatus.CLOSED.name())));
    }

    /**
     * Removes a contractor with no open orders. Its defaults go with it; closed orders and sent emails keep the copied
     * name but lose the link.
     */
    public boolean removeContractor(UUID estateId, UUID providerId) {
        db.deleteFrom(EQUIPMENTPROVIDERROUTE)
                .where(EQUIPMENTPROVIDERROUTE
                        .ESTATEID
                        .eq(estateId)
                        .and(EQUIPMENTPROVIDERROUTE.PROVIDERID.eq(providerId)))
                .execute();
        db.update(WORKORDER)
                .setNull(WORKORDER.ASSIGNEEPROVIDERID)
                .where(WORKORDER.ESTATEID.eq(estateId).and(WORKORDER.ASSIGNEEPROVIDERID.eq(providerId)))
                .execute();
        db.update(WORKORDERDISPATCH)
                .setNull(WORKORDERDISPATCH.PROVIDERID)
                .where(WORKORDERDISPATCH.ESTATEID.eq(estateId).and(WORKORDERDISPATCH.PROVIDERID.eq(providerId)))
                .execute();
        return db.deleteFrom(SERVICEPROVIDER)
                        .where(SERVICEPROVIDER.ID.eq(providerId).and(SERVICEPROVIDER.ESTATEID.eq(estateId)))
                        .execute()
                == 1;
    }

    public void setDefault(UUID estateId, EquipmentType type, UUID providerId) {
        db.insertInto(EQUIPMENTPROVIDERROUTE)
                .set(EQUIPMENTPROVIDERROUTE.ESTATEID, estateId)
                .set(EQUIPMENTPROVIDERROUTE.EQUIPMENTTYPE, type.name())
                .set(EQUIPMENTPROVIDERROUTE.PROVIDERID, providerId)
                .set(EQUIPMENTPROVIDERROUTE.UPDATEDAT, currentOffsetDateTime())
                .onConflict(EQUIPMENTPROVIDERROUTE.ESTATEID, EQUIPMENTPROVIDERROUTE.EQUIPMENTTYPE)
                .doUpdate()
                .set(EQUIPMENTPROVIDERROUTE.PROVIDERID, providerId)
                .set(EQUIPMENTPROVIDERROUTE.UPDATEDAT, currentOffsetDateTime())
                .execute();
    }

    public void clearDefault(UUID estateId, EquipmentType type) {
        db.deleteFrom(EQUIPMENTPROVIDERROUTE)
                .where(EQUIPMENTPROVIDERROUTE
                        .ESTATEID
                        .eq(estateId)
                        .and(EQUIPMENTPROVIDERROUTE.EQUIPMENTTYPE.eq(type.name())))
                .execute();
    }

    // --- Routing and classification ------------------------------------------------------------------------------

    /** Called in the submission transaction, so the queue entry exists exactly when the report does. */
    public void queue(UUID reportId, UUID estateId) {
        db.insertInto(REPORTROUTING)
                .set(REPORTROUTING.REPORTID, reportId)
                .set(REPORTROUTING.ESTATEID, estateId)
                .set(REPORTROUTING.STATE, RoutingState.CLASSIFYING.name())
                .set(REPORTROUTING.UPDATEDAT, currentOffsetDateTime())
                .execute();
    }

    public record Claim(UUID reportId, UUID estateId) {}

    /** Claims the next due report by setting a lease; skips rows another worker holds. */
    public Optional<Claim> claimClassification(OffsetDateTime now, OffsetDateTime lease) {
        var claim = db.select(REPORTROUTING.REPORTID, REPORTROUTING.ESTATEID)
                .from(REPORTROUTING)
                .where(REPORTROUTING
                        .STATE
                        .eq(RoutingState.CLASSIFYING.name())
                        .and(REPORTROUTING.NEXTATTEMPTAT.le(now))
                        .and(REPORTROUTING.LEASEUNTIL.isNull().or(REPORTROUTING.LEASEUNTIL.lt(now))))
                .orderBy(REPORTROUTING.NEXTATTEMPTAT, REPORTROUTING.REPORTID)
                .limit(1)
                .forUpdate()
                .skipLocked()
                .fetchOptional(row -> new Claim(row.value1(), row.value2()));
        claim.ifPresent(found -> db.update(REPORTROUTING)
                .set(REPORTROUTING.LEASEUNTIL, lease)
                .where(REPORTROUTING.REPORTID.eq(found.reportId()))
                .execute());
        return claim;
    }

    /** Locks the routing row if this worker's lease still holds it; a reclaimed row is no longer ours to write. */
    public Optional<Integer> lockClassificationLease(UUID reportId, OffsetDateTime lease) {
        return db.select(REPORTROUTING.ATTEMPTS)
                .from(REPORTROUTING)
                .where(REPORTROUTING
                        .REPORTID
                        .eq(reportId)
                        .and(REPORTROUTING.STATE.eq(RoutingState.CLASSIFYING.name()))
                        .and(REPORTROUTING.LEASEUNTIL.eq(lease)))
                .forUpdate()
                .fetchOptional(REPORTROUTING.ATTEMPTS);
    }

    public void retryClassification(UUID reportId, int attempts, OffsetDateTime next) {
        db.update(REPORTROUTING)
                .set(REPORTROUTING.ATTEMPTS, attempts)
                .set(REPORTROUTING.NEXTATTEMPTAT, next)
                .setNull(REPORTROUTING.LEASEUNTIL)
                .set(REPORTROUTING.UPDATEDAT, currentOffsetDateTime())
                .where(REPORTROUTING.REPORTID.eq(reportId))
                .execute();
    }

    public void review(UUID reportId, int attempts, String reason) {
        db.update(REPORTROUTING)
                .set(REPORTROUTING.STATE, RoutingState.NEEDS_REVIEW.name())
                .set(REPORTROUTING.REASON, reason)
                .set(REPORTROUTING.ATTEMPTS, attempts)
                .setNull(REPORTROUTING.LEASEUNTIL)
                .set(REPORTROUTING.UPDATEDAT, currentOffsetDateTime())
                .where(REPORTROUTING.REPORTID.eq(reportId))
                .execute();
    }

    public void recordClassification(UUID reportId, Classification classification) {
        recordClassification(reportId, classification, null);
    }

    /** Appends a classification; {@code classifiedBy} is the person who chose it, null for the model. */
    public void recordClassification(UUID reportId, Classification classification, String classifiedBy) {
        db.insertInto(REPORTCLASSIFICATION)
                .set(REPORTCLASSIFICATION.ID, UUID.randomUUID())
                .set(REPORTCLASSIFICATION.REPORTID, reportId)
                .set(REPORTCLASSIFICATION.OUTCOME, classification.outcome().name())
                .set(
                        REPORTCLASSIFICATION.EQUIPMENTTYPE,
                        classification.equipmentType() == null
                                ? null
                                : classification.equipmentType().name())
                .set(REPORTCLASSIFICATION.CONFIDENCE, classification.confidence())
                .set(REPORTCLASSIFICATION.REASON, classification.reason())
                .set(REPORTCLASSIFICATION.MODEL, classification.model())
                .set(
                        REPORTCLASSIFICATION.CATEGORY,
                        classification.category() == null
                                ? null
                                : classification.category().name())
                .set(REPORTCLASSIFICATION.CLASSIFIEDBYUSERID, classifiedBy)
                .execute();
    }

    /** The category of the report's newest classification; empty when it has none. */
    public Optional<FaultCategory> currentCategory(UUID reportId) {
        return db.select(REPORTCLASSIFICATION.CATEGORY)
                .from(REPORTCLASSIFICATION)
                .where(REPORTCLASSIFICATION.REPORTID.eq(reportId))
                .orderBy(REPORTCLASSIFICATION.CREATEDAT.desc(), REPORTCLASSIFICATION.ID.desc())
                .limit(1)
                .fetchOptional(REPORTCLASSIFICATION.CATEGORY)
                .map(FaultCategory::valueOf);
    }

    /** The current routing state, locked for a decision; empty for reports from before routing. */
    public Optional<RoutingState> lockState(UUID reportId) {
        return db.select(REPORTROUTING.STATE)
                .from(REPORTROUTING)
                .where(REPORTROUTING.REPORTID.eq(reportId))
                .forUpdate()
                .fetchOptional(row -> RoutingState.valueOf(row.value1()));
    }

    /** Records the outcome; {@code decidedBy} is null when the system routed it. */
    public void decide(UUID reportId, RoutingState state, String decidedBy, UUID workOrderId) {
        var update = db.update(REPORTROUTING)
                .set(REPORTROUTING.STATE, state.name())
                .set(REPORTROUTING.WORKORDERID, workOrderId)
                .setNull(REPORTROUTING.LEASEUNTIL)
                .set(REPORTROUTING.UPDATEDAT, currentOffsetDateTime());
        if (decidedBy != null)
            update = update.set(REPORTROUTING.DECIDEDBYUSERID, decidedBy)
                    .set(REPORTROUTING.DECIDEDAT, currentOffsetDateTime());
        update.where(REPORTROUTING.REPORTID.eq(reportId)).execute();
    }

    /** A work order created from a report awaiting review through the ID-36 form resolves the review. */
    public void resolveReview(UUID reportId, UUID workOrderId, String user) {
        db.update(REPORTROUTING)
                .set(REPORTROUTING.STATE, RoutingState.WORK_ORDER.name())
                .set(REPORTROUTING.WORKORDERID, workOrderId)
                .set(REPORTROUTING.DECIDEDBYUSERID, user)
                .set(REPORTROUTING.DECIDEDAT, currentOffsetDateTime())
                .set(REPORTROUTING.UPDATEDAT, currentOffsetDateTime())
                .where(REPORTROUTING
                        .REPORTID
                        .eq(reportId)
                        .and(REPORTROUTING.STATE.eq(RoutingState.NEEDS_REVIEW.name())))
                .execute();
    }

    // --- Reports as routing reads them ---------------------------------------------------------------------------

    public record StoredImage(String key, String contentType) {}

    public record Source(
            UUID reportId,
            UUID estateId,
            boolean estateActive,
            String estateName,
            String estateAddress,
            String locationLabel,
            OffsetDateTime createdAt,
            String title,
            String description,
            List<StoredImage> images) {}

    public Optional<Source> source(UUID reportId) {
        var row = db.select(
                        ISSUEREPORT.ESTATEID,
                        ESTATE.DEACTIVATEDAT,
                        ESTATE.NAME,
                        ESTATE.ADDRESS,
                        ESTATE.POSTALCODE,
                        LOCATION_LABEL,
                        ISSUEREPORT.CREATEDAT,
                        ISSUEREPORT.TITLE,
                        ISSUEREPORT.DESCRIPTION)
                .from(ISSUEREPORT)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ISSUEREPORT.ESTATEID))
                .join(LOCATION)
                .on(LOCATION.ID.eq(ISSUEREPORT.LOCATIONID))
                .leftJoin(PARENT)
                .on(PARENT.ID.eq(LOCATION.PARENTID))
                .leftJoin(GRANDPARENT)
                .on(GRANDPARENT.ID.eq(PARENT.PARENTID))
                .where(ISSUEREPORT.ID.eq(reportId))
                .fetchOne();
        if (row == null) return Optional.empty();
        var images = db.select(ISSUEREPORTIMAGE.STORAGEKEY, ISSUEREPORTIMAGE.CONTENTTYPE)
                .from(ISSUEREPORTIMAGE)
                .where(ISSUEREPORTIMAGE.REPORTID.eq(reportId))
                .orderBy(ISSUEREPORTIMAGE.CREATEDAT, ISSUEREPORTIMAGE.ID)
                .fetch(image -> new StoredImage(image.value1(), image.value2()));
        return Optional.of(new Source(
                reportId,
                row.value1(),
                row.value2() == null,
                row.value3(),
                row.value4() + ", " + row.value5(),
                row.value6(),
                row.value7(),
                row.value8(),
                row.value9(),
                images));
    }

    public boolean reportInEstate(UUID estateId, UUID reportId) {
        return db.fetchExists(ISSUEREPORT, ISSUEREPORT.ID.eq(reportId).and(ISSUEREPORT.ESTATEID.eq(estateId)));
    }

    // --- Dispatches ----------------------------------------------------------------------------------------------

    /** Queues the email to a contractor just given the order; {@code type} is null for non-equipment jobs. */
    public void createDispatch(
            UUID workOrderId,
            UUID estateId,
            EquipmentType type,
            UUID providerId,
            String name,
            String email,
            String approvedBy) {
        db.insertInto(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.ID, UUID.randomUUID())
                .set(WORKORDERDISPATCH.WORKORDERID, workOrderId)
                .set(WORKORDERDISPATCH.ESTATEID, estateId)
                .set(WORKORDERDISPATCH.PROVIDERID, providerId)
                .set(WORKORDERDISPATCH.EQUIPMENTTYPE, type == null ? null : type.name())
                .set(WORKORDERDISPATCH.CONTRACTORNAME, name)
                .set(WORKORDERDISPATCH.CONTRACTOREMAIL, email)
                .set(WORKORDERDISPATCH.APPROVEDBYUSERID, approvedBy)
                .set(WORKORDERDISPATCH.STATUS, DispatchStatus.PENDING.name())
                .set(WORKORDERDISPATCH.UPDATEDAT, currentOffsetDateTime())
                .execute();
    }

    public boolean workOrderInEstate(UUID estateId, UUID workOrderId) {
        return db.fetchExists(WORKORDER, WORKORDER.ID.eq(workOrderId).and(WORKORDER.ESTATEID.eq(estateId)));
    }

    public boolean hasDispatch(UUID workOrderId) {
        return db.fetchExists(WORKORDERDISPATCH, WORKORDERDISPATCH.WORKORDERID.eq(workOrderId));
    }

    /** The reason recorded on an email that must never go because the contractor no longer has the job. */
    public static final String SUPERSEDED = "SUPERSEDED";

    /** Fails the order's pending emails that no worker is sending right now; a leased in-flight send may still go. */
    public void supersedePending(UUID workOrderId, OffsetDateTime now) {
        db.update(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.STATUS, DispatchStatus.FAILED.name())
                .set(WORKORDERDISPATCH.LASTERRORCODE, SUPERSEDED)
                .set(WORKORDERDISPATCH.UPDATEDAT, currentOffsetDateTime())
                .where(WORKORDERDISPATCH
                        .WORKORDERID
                        .eq(workOrderId)
                        .and(WORKORDERDISPATCH.STATUS.eq(DispatchStatus.PENDING.name()))
                        .and(WORKORDERDISPATCH.LEASEUNTIL.isNull().or(WORKORDERDISPATCH.LEASEUNTIL.lt(now))))
                .execute();
    }

    public Optional<UUID> claimDispatch(OffsetDateTime now, OffsetDateTime lease) {
        var id = db.select(WORKORDERDISPATCH.ID)
                .from(WORKORDERDISPATCH)
                .where(WORKORDERDISPATCH
                        .STATUS
                        .eq(DispatchStatus.PENDING.name())
                        .and(WORKORDERDISPATCH.NEXTATTEMPTAT.le(now))
                        .and(WORKORDERDISPATCH.LEASEUNTIL.isNull().or(WORKORDERDISPATCH.LEASEUNTIL.lt(now))))
                .orderBy(WORKORDERDISPATCH.NEXTATTEMPTAT, WORKORDERDISPATCH.ID)
                .limit(1)
                .forUpdate()
                .skipLocked()
                .fetchOptional(WORKORDERDISPATCH.ID);
        id.ifPresent(dispatchId -> db.update(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.LEASEUNTIL, lease)
                .where(WORKORDERDISPATCH.ID.eq(dispatchId))
                .execute());
        return id;
    }

    /** {@code reportId} is null for a job that did not come from a resident report; {@code equipmentType} may be. */
    public record Delivery(
            UUID id,
            UUID workOrderId,
            String reference,
            UUID reportId,
            EquipmentType equipmentType,
            String name,
            String email,
            int attempts) {}

    public Optional<Delivery> delivery(UUID dispatchId) {
        return db.select(
                        WORKORDERDISPATCH.ID,
                        WORKORDER.ID,
                        WORKORDER.REFERENCE,
                        WORKORDER.SOURCEREPORTID,
                        WORKORDERDISPATCH.EQUIPMENTTYPE,
                        WORKORDERDISPATCH.CONTRACTORNAME,
                        WORKORDERDISPATCH.CONTRACTOREMAIL,
                        WORKORDERDISPATCH.ATTEMPTS)
                .from(WORKORDERDISPATCH)
                .join(WORKORDER)
                .on(WORKORDER.ID.eq(WORKORDERDISPATCH.WORKORDERID))
                .where(WORKORDERDISPATCH.ID.eq(dispatchId))
                .fetchOptional(row -> new Delivery(
                        row.value1(),
                        row.value2(),
                        row.value3(),
                        row.value4(),
                        row.value5() == null ? null : EquipmentType.valueOf(row.value5()),
                        row.value6(),
                        row.value7(),
                        row.value8()));
    }

    /** What a contractor needs to know about a job that did not come from a resident report. */
    public Optional<WorkOrderEmail.Job> job(Delivery delivery) {
        return db.select(ESTATE.NAME, ESTATE.ADDRESS, ESTATE.POSTALCODE, LOCATION_LABEL, WORKORDER.DESCRIPTION)
                .from(WORKORDER)
                .join(ESTATE)
                .on(ESTATE.ID.eq(WORKORDER.ESTATEID))
                .join(LOCATION)
                .on(LOCATION.ID.eq(WORKORDER.LOCATIONID))
                .leftJoin(PARENT)
                .on(PARENT.ID.eq(LOCATION.PARENTID))
                .leftJoin(GRANDPARENT)
                .on(GRANDPARENT.ID.eq(PARENT.PARENTID))
                .where(WORKORDER.ID.eq(delivery.workOrderId()))
                .fetchOptional(row -> new WorkOrderEmail.Job(
                        delivery.reference(),
                        delivery.name(),
                        delivery.email(),
                        row.value1(),
                        row.value2() + ", " + row.value3(),
                        row.value4(),
                        row.value5()));
    }

    public boolean lockDispatchLease(UUID dispatchId, OffsetDateTime lease) {
        return db.fetchExists(db.selectOne()
                .from(WORKORDERDISPATCH)
                .where(WORKORDERDISPATCH
                        .ID
                        .eq(dispatchId)
                        .and(WORKORDERDISPATCH.STATUS.eq(DispatchStatus.PENDING.name()))
                        .and(WORKORDERDISPATCH.LEASEUNTIL.eq(lease)))
                .forUpdate());
    }

    public void markSent(UUID dispatchId, int attempts, OffsetDateTime sentAt) {
        db.update(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.STATUS, DispatchStatus.SENT.name())
                .set(WORKORDERDISPATCH.ATTEMPTS, attempts)
                .set(WORKORDERDISPATCH.SENTAT, sentAt)
                .setNull(WORKORDERDISPATCH.LEASEUNTIL)
                .setNull(WORKORDERDISPATCH.LASTERRORCODE)
                .set(WORKORDERDISPATCH.UPDATEDAT, currentOffsetDateTime())
                .where(WORKORDERDISPATCH.ID.eq(dispatchId))
                .execute();
    }

    public void sendFailed(
            UUID dispatchId, DispatchStatus status, int attempts, OffsetDateTime next, String errorCode) {
        db.update(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.STATUS, status.name())
                .set(WORKORDERDISPATCH.ATTEMPTS, attempts)
                .set(WORKORDERDISPATCH.NEXTATTEMPTAT, next)
                .set(WORKORDERDISPATCH.LASTERRORCODE, errorCode)
                .setNull(WORKORDERDISPATCH.LEASEUNTIL)
                .set(WORKORDERDISPATCH.UPDATEDAT, currentOffsetDateTime())
                .where(WORKORDERDISPATCH.ID.eq(dispatchId))
                .execute();
    }

    public record LatestDispatch(UUID id, DispatchStatus status, String lastErrorCode) {}

    /** A work order's newest email in this estate, locked for a retry. */
    public Optional<LatestDispatch> lockDispatch(UUID estateId, UUID workOrderId) {
        return db.select(WORKORDERDISPATCH.ID, WORKORDERDISPATCH.STATUS, WORKORDERDISPATCH.LASTERRORCODE)
                .from(WORKORDERDISPATCH)
                .where(WORKORDERDISPATCH.WORKORDERID.eq(workOrderId).and(WORKORDERDISPATCH.ESTATEID.eq(estateId)))
                .orderBy(WORKORDERDISPATCH.CREATEDAT.desc(), WORKORDERDISPATCH.ID.desc())
                .limit(1)
                .forUpdate()
                .fetchOptional(
                        row -> new LatestDispatch(row.value1(), DispatchStatus.valueOf(row.value2()), row.value3()));
    }

    public void requeue(UUID dispatchId) {
        db.update(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.STATUS, DispatchStatus.PENDING.name())
                .set(WORKORDERDISPATCH.ATTEMPTS, 0)
                .set(WORKORDERDISPATCH.NEXTATTEMPTAT, currentOffsetDateTime())
                .setNull(WORKORDERDISPATCH.LEASEUNTIL)
                .setNull(WORKORDERDISPATCH.LASTERRORCODE)
                .set(WORKORDERDISPATCH.UPDATEDAT, currentOffsetDateTime())
                .where(WORKORDERDISPATCH.ID.eq(dispatchId))
                .execute();
    }

    // --- Responses -----------------------------------------------------------------------------------------------

    public Optional<WorkOrderDispatchResponse> dispatch(UUID workOrderId) {
        return Optional.ofNullable(
                dispatches(WORKORDERDISPATCH.WORKORDERID.eq(workOrderId)).get(workOrderId));
    }

    /** Routing for each report that has it; reports from before routing are absent from the map. */
    public Map<UUID, ReportRoutingResponse> routings(Collection<UUID> reportIds) {
        if (reportIds.isEmpty()) return Map.of();
        var classifications = new HashMap<UUID, ReportRoutingResponse.ClassificationResponse>();
        var names = new HashMap<String, String>();
        db.selectDistinct(
                        REPORTCLASSIFICATION.REPORTID,
                        REPORTCLASSIFICATION.OUTCOME,
                        REPORTCLASSIFICATION.EQUIPMENTTYPE,
                        REPORTCLASSIFICATION.CONFIDENCE,
                        REPORTCLASSIFICATION.REASON,
                        REPORTCLASSIFICATION.CREATEDAT,
                        REPORTCLASSIFICATION.CATEGORY,
                        REPORTCLASSIFICATION.MODEL,
                        REPORTCLASSIFICATION.CLASSIFIEDBYUSERID)
                .on(REPORTCLASSIFICATION.REPORTID)
                .from(REPORTCLASSIFICATION)
                .where(REPORTCLASSIFICATION.REPORTID.in(reportIds))
                .orderBy(
                        REPORTCLASSIFICATION.REPORTID,
                        REPORTCLASSIFICATION.CREATEDAT.desc(),
                        REPORTCLASSIFICATION.ID.desc())
                .fetch()
                .forEach(row -> classifications.put(
                        row.value1(),
                        new ReportRoutingResponse.ClassificationResponse(
                                ClassificationOutcome.valueOf(row.value2()),
                                row.value3() == null ? null : EquipmentType.valueOf(row.value3()),
                                row.value7() == null ? null : FaultCategory.valueOf(row.value7()),
                                row.value4(),
                                row.value5(),
                                Classification.MANUAL.equals(row.value8()),
                                row.value9() == null
                                        ? null
                                        : names.computeIfAbsent(
                                                row.value9(),
                                                user -> workOS.findDisplayName(user)
                                                        .orElse(null)),
                                row.value6())));
        var rows = db.select(
                        REPORTROUTING.REPORTID,
                        REPORTROUTING.STATE,
                        REPORTROUTING.REASON,
                        REPORTROUTING.DECIDEDAT,
                        WORKORDER.ID,
                        WORKORDER.REFERENCE,
                        WORKORDER.STATUS)
                .from(REPORTROUTING)
                .leftJoin(WORKORDER)
                .on(WORKORDER.ID.eq(REPORTROUTING.WORKORDERID))
                .where(REPORTROUTING.REPORTID.in(reportIds))
                .fetch();
        var dispatches = dispatches(WORKORDERDISPATCH.WORKORDERID.in(rows.getValues(WORKORDER.ID)));
        var routings = new HashMap<UUID, ReportRoutingResponse>();
        for (var row : rows) {
            var workOrderId = row.get(WORKORDER.ID);
            routings.put(
                    row.get(REPORTROUTING.REPORTID),
                    new ReportRoutingResponse(
                            RoutingState.valueOf(row.get(REPORTROUTING.STATE)),
                            row.get(REPORTROUTING.REASON),
                            classifications.get(row.get(REPORTROUTING.REPORTID)),
                            workOrderId == null
                                    ? null
                                    : new ReportRoutingResponse.RoutedWorkOrder(
                                            workOrderId,
                                            row.get(WORKORDER.REFERENCE),
                                            WorkOrderStatus.valueOf(row.get(WORKORDER.STATUS)),
                                            dispatches.get(workOrderId)),
                            row.get(REPORTROUTING.DECIDEDAT)));
        }
        return routings;
    }

    private Map<UUID, WorkOrderDispatchResponse> dispatches(Condition condition) {
        var found = new HashMap<UUID, WorkOrderDispatchResponse>();
        db.selectDistinct(
                        WORKORDERDISPATCH.WORKORDERID,
                        WORKORDERDISPATCH.EQUIPMENTTYPE,
                        WORKORDERDISPATCH.CONTRACTORNAME,
                        WORKORDERDISPATCH.CONTRACTOREMAIL,
                        WORKORDERDISPATCH.APPROVEDBYUSERID,
                        WORKORDERDISPATCH.STATUS,
                        WORKORDERDISPATCH.SENTAT,
                        WORKORDERDISPATCH.CREATEDAT)
                .on(WORKORDERDISPATCH.WORKORDERID)
                .from(WORKORDERDISPATCH)
                .where(condition)
                .orderBy(WORKORDERDISPATCH.WORKORDERID, WORKORDERDISPATCH.CREATEDAT.desc(), WORKORDERDISPATCH.ID.desc())
                .fetch()
                .forEach(row -> found.put(
                        row.value1(),
                        new WorkOrderDispatchResponse(
                                row.value2() == null ? null : EquipmentType.valueOf(row.value2()),
                                row.value3(),
                                row.value4(),
                                row.value5() == null
                                        ? WorkOrderDispatchResponse.Approval.AUTOMATIC
                                        : WorkOrderDispatchResponse.Approval.MANAGER,
                                DispatchStatus.valueOf(row.value6()),
                                row.value7(),
                                row.value8())));
        return found;
    }
}
