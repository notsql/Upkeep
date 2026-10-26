package com.proj.server.workorder;

import com.proj.server.report.EstateReportRepository;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkOrderService {
    private final WorkOrderRepository repository;
    private final EstateReportRepository locations;
    private final com.proj.server.workos.WorkOSService workOS;

    public WorkOrderService(
            WorkOrderRepository repository,
            EstateReportRepository locations,
            com.proj.server.workos.WorkOSService workOS) {
        this.repository = repository;
        this.locations = locations;
        this.workOS = workOS;
    }

    com.proj.server.db.tables.records.EstateRecord authorize(UUID estateId, String user, boolean create, boolean lock) {
        var estate = repository.estate(estateId, lock);
        if (estate == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        var role = repository.role(estateId, user);
        boolean owner = user.equals(estate.getOwneruserid());
        boolean manager = owner || "MANAGER".equals(role);
        boolean allowed = !"RESIDENT".equals(role) && (manager || (!create && "CREW".equals(role)));
        if (!allowed)
            throw error(
                    owner || role != null ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND,
                    owner || role != null
                            ? "Work-order access is unavailable for this membership."
                            : "Estate not found.");
        if (create && estate.getDeactivatedat() != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
        return estate;
    }

    @Transactional
    public WorkOrderResponse create(UUID estateId, String user, CreateWorkOrderRequest request) {
        var estate = authorize(estateId, user, true, true);
        if (request.category() == WorkOrderCategory.SAFETY && request.priority() != WorkOrderPriority.URGENT)
            throw error(HttpStatus.BAD_REQUEST, "Safety work orders must be urgent.");
        boolean report = request.source() == WorkOrderSource.RESIDENT_REPORT;
        boolean inspection = request.sourceInspectionId() != null;
        if ((inspection && request.source() != WorkOrderSource.INSPECTION)
                || report != (request.sourceReportId() != null)
                || (report || inspection) != (request.expectedSourceLocationId() != null))
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Report sources require a report and its observed location; other sources cannot include them.");
        boolean referenceRequired = (request.source() == WorkOrderSource.INSPECTION && !inspection)
                || request.source() == WorkOrderSource.MAINTENANCE_RECOMMENDATION;
        if (referenceRequired
                && (request.sourceReference() == null
                        || request.sourceReference().isBlank()))
            throw error(HttpStatus.BAD_REQUEST, "Enter a source reference or explanation.");
        if (report) {
            var role = repository.role(estateId, user);
            if (!"MANAGER".equals(role) && !"CREW".equals(role))
                throw error(HttpStatus.FORBIDDEN, "Responder membership required to use a report.");
            var sourceLocation = repository.reportLocation(estateId, request.sourceReportId());
            if (sourceLocation == null) throw error(HttpStatus.NOT_FOUND, "Report not found.");
            if (!sourceLocation.equals(request.expectedSourceLocationId()))
                throw error(HttpStatus.CONFLICT, "The report location changed. Reload the source before saving.");
        }
        requireActiveLocation(estateId, request.locationId());
        if (inspection && request.assetId() == null)
            throw error(HttpStatus.BAD_REQUEST, "A linked inspection requires its asset.");
        if (request.assetId() != null) {
            var asset = repository.asset(estateId, request.assetId());
            if (asset == null) throw error(HttpStatus.NOT_FOUND, "Asset not found.");
            if (asset.getDeactivatedat() != null || asset.getRetiredon() != null)
                throw error(HttpStatus.CONFLICT, "This asset is inactive or retired.");
            requireActiveLocation(estateId, asset.getLocationid());
            if (inspection && !asset.getLocationid().equals(request.expectedSourceLocationId()))
                throw error(
                        HttpStatus.CONFLICT,
                        "The asset location changed. Reload the inspection source and review its current location.");
            if (!request.locationId().equals(asset.getLocationid()))
                throw error(
                        inspection ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST,
                        "The work location must match the linked asset's registered location.");
        }
        String reference = request.sourceReference();
        if (inspection) {
            var source = repository.inspection(estateId, request.sourceInspectionId());
            if (source == null) throw error(HttpStatus.NOT_FOUND, "Inspection not found.");
            if (!"FAIL".equals(source.getOutcome()) || !source.getAssetid().equals(request.assetId()))
                throw error(HttpStatus.BAD_REQUEST, "Choose a failed inspection for the linked asset.");
            String existing = repository.inspectionOrder(estateId, source.getId());
            if (existing != null)
                throw error(HttpStatus.CONFLICT, "Work order " + existing + " already exists for this inspection.");
            reference = "Inspection " + source.getInspectedon() + " (" + source.getId() + ")";
        }
        var id = repository.create(estateId, estate.getCode(), user, request, reference);
        return repository.detail(estateId, id);
    }

    private void requireActiveLocation(UUID estateId, UUID id) {
        var location = locations.location(estateId, id);
        if (location == null) throw error(HttpStatus.NOT_FOUND, "Location not found.");
        if (!Boolean.TRUE.equals(location.get("active", Boolean.class)))
            throw error(HttpStatus.CONFLICT, "The location or an ancestor is inactive.");
    }

    public WorkOrderResponse detail(UUID estateId, String user, UUID id) {
        authorize(estateId, user, false, false);
        var order = repository.detail(estateId, id);
        if (order == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        return resolveCreatorName(order);
    }

    // Creation calls this after its transaction commits, so provider latency never holds the estate lock.
    public WorkOrderResponse resolveCreatorName(WorkOrderResponse order) {
        return order.withCreatorName(
                workOS.findDisplayName(order.createdByUserId()).orElse(null));
    }

    public WorkOrderPageResponse list(
            UUID estateId,
            String user,
            WorkOrderPriority priority,
            WorkOrderStatus status,
            WorkOrderCategory category,
            String query,
            WorkOrderSort sortBy,
            WorkOrderSortDirection direction,
            String cursor,
            Integer requestedLimit) {
        authorize(estateId, user, false, false);
        if (query != null && query.length() > 200)
            throw error(HttpStatus.BAD_REQUEST, "Reference search must be at most 200 characters.");
        int limit = limit(requestedLimit);
        var id = orderCursor(cursor, sortBy, direction);
        var found = repository.list(
                estateId,
                priority,
                status,
                category,
                query == null ? null : query.trim(),
                sortBy,
                direction,
                id,
                limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        var last = page.isEmpty() ? null : page.getLast();
        return new WorkOrderPageResponse(
                page,
                found.size() > limit
                        ? encode(
                                (sortBy == WorkOrderSort.PRIORITY ? "v3|" : "v2|") + sortBy + "|" + direction,
                                last.id())
                        : null);
    }

    private static UUID orderCursor(String cursor, WorkOrderSort sort, WorkOrderSortDirection direction) {
        if (cursor == null) return null;
        try {
            if (cursor.length() > 2048) throw new IllegalArgumentException();
            var parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
            if (parts.length == 4
                    && parts[0].equals(sort == WorkOrderSort.PRIORITY ? "v3" : "v2")
                    && parts[1].equals(sort.name())
                    && parts[2].equals(direction.name())) return UUID.fromString(parts[3]);
            if (parts.length == 2 && sort == WorkOrderSort.CREATED_AT && direction == WorkOrderSortDirection.DESC) {
                OffsetDateTime.parse(parts[0]);
                return UUID.fromString(parts[1]);
            }
            throw new IllegalArgumentException();
        } catch (RuntimeException invalid) {
            throw error(HttpStatus.BAD_REQUEST, "Invalid or mismatched work-order cursor.");
        }
    }

    public WorkOrderAssetPageResponse assets(
            UUID estateId, String user, String query, String cursor, Integer requestedLimit) {
        authorize(estateId, user, true, false);
        if (query != null && query.length() > 200)
            throw error(HttpStatus.BAD_REQUEST, "Asset search must be at most 200 characters.");
        int limit = limit(requestedLimit);
        var parts = decode(cursor);
        UUID id = null;
        if (parts != null) {
            try {
                id = UUID.fromString(parts[1]);
            } catch (RuntimeException invalid) {
                throw error(HttpStatus.BAD_REQUEST, "Invalid asset cursor.");
            }
        }
        var found = repository.assets(estateId, query, parts == null ? null : parts[0], id, limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        var last = page.isEmpty() ? null : page.getLast();
        return new WorkOrderAssetPageResponse(page, found.size() > limit ? encode(last.reference(), last.id()) : null);
    }

    private static int limit(Integer requested) {
        int limit = requested == null ? 20 : requested;
        if (limit < 1 || limit > 50) throw error(HttpStatus.BAD_REQUEST, "Limit must be between 1 and 50.");
        return limit;
    }

    private static String[] decode(String cursor) {
        if (cursor == null) return null;
        try {
            if (cursor.length() > 2048) throw new IllegalArgumentException();
            var decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = decoded.lastIndexOf('|');
            if (separator < 1) throw new IllegalArgumentException();
            return new String[] {decoded.substring(0, separator), decoded.substring(separator + 1)};
        } catch (RuntimeException invalid) {
            throw error(HttpStatus.BAD_REQUEST, "Invalid pagination cursor.");
        }
    }

    private static String encode(String value, UUID id) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString((value + "|" + id).getBytes(StandardCharsets.UTF_8));
    }

    private static WorkOrderException error(HttpStatus status, String message) {
        return new WorkOrderException(status, message);
    }
}
