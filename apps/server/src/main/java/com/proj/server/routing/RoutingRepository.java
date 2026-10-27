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

    public RoutingRepository(DSLContext db) {
        this.db = db;
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

    /** One provider per email address in an estate; saving the same address again updates its name. */
    public Contractor saveContractor(UUID estateId, EquipmentType type, String name, String email) {
        var provider = db.insertInto(SERVICEPROVIDER)
                .set(SERVICEPROVIDER.ID, UUID.randomUUID())
                .set(SERVICEPROVIDER.ESTATEID, estateId)
                .set(SERVICEPROVIDER.NAME, name)
                .set(SERVICEPROVIDER.EMAIL, email)
                .set(SERVICEPROVIDER.UPDATEDAT, currentOffsetDateTime())
                .onConflict(SERVICEPROVIDER.ESTATEID, SERVICEPROVIDER.EMAIL)
                .doUpdate()
                .set(SERVICEPROVIDER.NAME, name)
                .set(SERVICEPROVIDER.UPDATEDAT, currentOffsetDateTime())
                .returning(SERVICEPROVIDER.ID, SERVICEPROVIDER.UPDATEDAT)
                .fetchOne();
        var providerId = provider.get(SERVICEPROVIDER.ID);
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
        return new Contractor(providerId, type, name, email, provider.get(SERVICEPROVIDER.UPDATEDAT));
    }

    /** Removes the route only: the provider stays, because work orders may be assigned to it. */
    public void removeContractor(UUID estateId, EquipmentType type) {
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
                .execute();
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

    public void createDispatch(
            UUID workOrderId, UUID estateId, EquipmentType type, Contractor contractor, String approvedBy) {
        db.insertInto(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.ID, UUID.randomUUID())
                .set(WORKORDERDISPATCH.WORKORDERID, workOrderId)
                .set(WORKORDERDISPATCH.ESTATEID, estateId)
                .set(WORKORDERDISPATCH.PROVIDERID, contractor.providerId())
                .set(WORKORDERDISPATCH.EQUIPMENTTYPE, type.name())
                .set(WORKORDERDISPATCH.CONTRACTORNAME, contractor.name())
                .set(WORKORDERDISPATCH.CONTRACTOREMAIL, contractor.email())
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

    public record Delivery(
            UUID id,
            String reference,
            UUID reportId,
            EquipmentType equipmentType,
            String name,
            String email,
            int attempts) {}

    public Optional<Delivery> delivery(UUID dispatchId) {
        return db.select(
                        WORKORDERDISPATCH.ID,
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
                        EquipmentType.valueOf(row.value4()),
                        row.value5(),
                        row.value6(),
                        row.value7()));
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

    /** The dispatch status of a work order in this estate, locked for a retry. */
    public Optional<DispatchStatus> lockDispatch(UUID estateId, UUID workOrderId) {
        return db.select(WORKORDERDISPATCH.STATUS)
                .from(WORKORDERDISPATCH)
                .where(WORKORDERDISPATCH.WORKORDERID.eq(workOrderId).and(WORKORDERDISPATCH.ESTATEID.eq(estateId)))
                .forUpdate()
                .fetchOptional(row -> DispatchStatus.valueOf(row.value1()));
    }

    public void requeue(UUID workOrderId) {
        db.update(WORKORDERDISPATCH)
                .set(WORKORDERDISPATCH.STATUS, DispatchStatus.PENDING.name())
                .set(WORKORDERDISPATCH.ATTEMPTS, 0)
                .set(WORKORDERDISPATCH.NEXTATTEMPTAT, currentOffsetDateTime())
                .setNull(WORKORDERDISPATCH.LEASEUNTIL)
                .setNull(WORKORDERDISPATCH.LASTERRORCODE)
                .set(WORKORDERDISPATCH.UPDATEDAT, currentOffsetDateTime())
                .where(WORKORDERDISPATCH.WORKORDERID.eq(workOrderId))
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
        db.selectDistinct(
                        REPORTCLASSIFICATION.REPORTID,
                        REPORTCLASSIFICATION.OUTCOME,
                        REPORTCLASSIFICATION.EQUIPMENTTYPE,
                        REPORTCLASSIFICATION.CONFIDENCE,
                        REPORTCLASSIFICATION.REASON,
                        REPORTCLASSIFICATION.CREATEDAT)
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
                                row.value4(),
                                row.value5(),
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
        db.select(
                        WORKORDERDISPATCH.WORKORDERID,
                        WORKORDERDISPATCH.EQUIPMENTTYPE,
                        WORKORDERDISPATCH.CONTRACTORNAME,
                        WORKORDERDISPATCH.CONTRACTOREMAIL,
                        WORKORDERDISPATCH.APPROVEDBYUSERID,
                        WORKORDERDISPATCH.STATUS,
                        WORKORDERDISPATCH.SENTAT,
                        WORKORDERDISPATCH.CREATEDAT)
                .from(WORKORDERDISPATCH)
                .where(condition)
                .fetch()
                .forEach(row -> found.put(
                        row.value1(),
                        new WorkOrderDispatchResponse(
                                EquipmentType.valueOf(row.value2()),
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
