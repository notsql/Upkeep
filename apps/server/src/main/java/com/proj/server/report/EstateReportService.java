package com.proj.server.report;

import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.resident.ResidentImageStore;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.resident.ResidentReportRepository;
import com.proj.server.resident.ResidentReportService.ImageBytes;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jooq.Record;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EstateReportService {
    private final EstateReportRepository repository;
    private final ResidentReportRepository reports;
    private final ResidentImageStore images;
    private final DuplicateRepository duplicates;
    private final ReportUrgencyRepository urgency;

    public EstateReportService(
            EstateReportRepository repository,
            ResidentReportRepository reports,
            ResidentImageStore images,
            DuplicateRepository duplicates,
            ReportUrgencyRepository urgency) {
        this.repository = repository;
        this.reports = reports;
        this.images = images;
        this.duplicates = duplicates;
        this.urgency = urgency;
    }

    public Record authorize(UUID estateId, String user, EstatePermissionCode permission, boolean lock) {
        var estate = repository.estate(estateId, lock);
        if (estate == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        var role = repository.role(estateId, user, lock);
        boolean customAllowed = "CUSTOM".equals(role) && repository.hasPermission(estateId, user, permission);
        if (!"MANAGER".equals(role) && !"CREW".equals(role) && !customAllowed) {
            boolean known = user.equals(estate.get("ownerUserId", String.class))
                    || (role != null
                            && Set.of("MEMBER", "COUNCIL", "RESIDENT", "CUSTOM").contains(role));
            throw error(
                    known ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND,
                    known ? "Responder membership required." : "Estate not found.");
        }
        return estate;
    }

    public EstateIssueReportPageResponse list(
            UUID estateId,
            String user,
            UUID locationId,
            UUID blockId,
            Integer minLevelPosition,
            Integer maxLevelPosition,
            String cursor,
            Integer requestedLimit,
            boolean openOnly,
            ReportSort sort) {
        authorize(estateId, user, EstatePermissionCode.VIEW_FAULT_REPORTS, false);
        if (locationId != null && repository.location(estateId, locationId) == null)
            throw error(HttpStatus.NOT_FOUND, "Location not found.");
        if (blockId != null) {
            var block = repository.location(estateId, blockId);
            if (block == null) throw error(HttpStatus.NOT_FOUND, "Block not found.");
            if (!"BLOCK".equals(block.get("type", String.class)))
                throw error(HttpStatus.BAD_REQUEST, "Choose a block for the block filter.");
        }
        if (minLevelPosition != null && maxLevelPosition != null && minLevelPosition > maxLevelPosition)
            throw error(HttpStatus.BAD_REQUEST, "Minimum position must not exceed maximum position.");
        int limit = requestedLimit == null ? 20 : requestedLimit;
        if (limit < 1 || limit > 50) throw error(HttpStatus.BAD_REQUEST, "Limit must be between 1 and 50.");
        var scope = ReportQueueCursor.scope(
                estateId, locationId, blockId, minLevelPosition, maxLevelPosition, openOnly, sort);
        var before = ReportQueueCursor.decode(cursor, scope);
        var found = reports.estateList(
                estateId, locationId, blockId, minLevelPosition, maxLevelPosition, before, openOnly, sort, limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        String next = null;
        if (found.size() > limit) {
            var last = page.getLast();
            next = new ReportQueueCursor(last.isSafety(), last.urgency().rank(), last.createdAt(), last.id())
                    .encode(scope);
        }
        var info = duplicates.summaries(
                estateId, page.stream().map(report -> report.id()).toList());
        var items = page.stream()
                .map(report -> report.withDuplicates(info.getOrDefault(report.id(), DuplicateRepository.NONE)))
                .toList();
        return new EstateIssueReportPageResponse(items, next);
    }

    public EstateIssueReportDetailResponse detail(UUID estateId, String user, UUID reportId) {
        authorize(estateId, user, EstatePermissionCode.VIEW_FAULT_REPORTS, false);
        return find(estateId, reportId);
    }

    public ImageBytes image(UUID estateId, String user, UUID reportId, UUID imageId) {
        authorize(estateId, user, EstatePermissionCode.VIEW_FAULT_REPORTS, false);
        var image = reports.estateImage(estateId, reportId, imageId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Report image not found."));
        return new ImageBytes(images.read(image.key()), image.contentType());
    }

    @Transactional
    public EstateIssueReportDetailResponse relocate(
            UUID estateId, String user, UUID reportId, RelocateReportRequest request) {
        var estate = authorize(estateId, user, EstatePermissionCode.RELOCATE_FAULT_REPORTS, true);
        if (estate.get("deactivatedAt") != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
        var report = find(estateId, reportId);
        if (!report.location().id().equals(request.expectedLocationId()))
            throw error(HttpStatus.CONFLICT, "The location changed. Reload before correcting it.");
        var destination = repository.location(estateId, request.locationId());
        if (destination == null) throw error(HttpStatus.NOT_FOUND, "Location not found.");
        if ("BLOCK".equals(destination.get("type", String.class)))
            throw error(HttpStatus.BAD_REQUEST, "Choose a level or common area.");
        if (!Boolean.TRUE.equals(destination.get("active", Boolean.class)))
            throw error(HttpStatus.CONFLICT, "The destination or an ancestor is inactive.");
        if (report.location().id().equals(request.locationId())) return report;
        repository.relocate(estateId, reportId, request.locationId());
        return find(estateId, reportId);
    }

    @Transactional
    public EstateIssueReportDetailResponse review(
            UUID estateId, String user, UUID reportId, ReviewDuplicateRequest request) {
        authorizeActiveManager(estateId, user);
        if (!duplicates.reportExists(estateId, reportId)) throw error(HttpStatus.NOT_FOUND, "Report not found.");
        var current = duplicates.lockedState(estateId, reportId);
        if (current == null) throw error(HttpStatus.NOT_FOUND, "This report is not linked to another report.");
        boolean allowed = (request.expectedState() == DuplicateState.SUSPECTED
                        && request.state() != DuplicateState.SUSPECTED)
                || (request.expectedState() == DuplicateState.CONFIRMED && request.state() == DuplicateState.REJECTED);
        if (!allowed) throw error(HttpStatus.BAD_REQUEST, "That duplicate decision is not allowed.");
        if (current != request.expectedState())
            throw error(HttpStatus.CONFLICT, "The duplicate link changed. Reload before deciding.");
        duplicates.decide(estateId, reportId, request.state(), user);
        return find(estateId, reportId);
    }

    @Transactional
    public EstateIssueReportDetailResponse link(
            UUID estateId, String user, UUID reportId, LinkDuplicateRequest request) {
        authorizeActiveManager(estateId, user);
        var originalId = request.originalReportId();
        if (!duplicates.reportExists(estateId, reportId)) throw error(HttpStatus.NOT_FOUND, "Report not found.");
        if (!duplicates.reportExists(estateId, originalId))
            throw error(HttpStatus.NOT_FOUND, "Original report not found.");
        if (reportId.equals(originalId)) throw error(HttpStatus.BAD_REQUEST, "A report cannot duplicate itself.");
        var current = duplicates.lockedState(estateId, reportId);
        if (current == DuplicateState.SUSPECTED || current == DuplicateState.CONFIRMED)
            throw error(HttpStatus.CONFLICT, "This report is already linked. Reload before linking.");
        if (duplicates.hasActiveLink(estateId, originalId))
            throw error(HttpStatus.BAD_REQUEST, "That report is itself a duplicate. Link to its original instead.");
        if (duplicates.hasActiveDuplicates(estateId, reportId))
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "This report has duplicates of its own. Reject them before linking it to another report.");
        duplicates.linkManually(estateId, reportId, originalId, user);
        return find(estateId, reportId);
    }

    /** Reviewing and linking duplicates needs current MANAGER membership in an active estate. */
    private void authorizeActiveManager(UUID estateId, String user) {
        var estate = repository.estate(estateId, true);
        if (estate == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        var role = repository.role(estateId, user, true);
        if (!"MANAGER".equals(role)) {
            boolean known = user.equals(estate.get("ownerUserId", String.class)) || role != null;
            throw error(
                    known ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND,
                    known ? "Manager membership required." : "Estate not found.");
        }
        if (estate.get("deactivatedAt") != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
    }

    EstateIssueReportDetailResponse find(UUID estateId, UUID reportId) {
        var report = reports.estateDetail(estateId, reportId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Report not found."));
        var info = duplicates.summaries(estateId, List.of(reportId)).getOrDefault(reportId, DuplicateRepository.NONE);
        return EstateIssueReportDetailResponse.of(
                report,
                info,
                duplicates.linked(estateId, reportId),
                urgency.values(estateId, reportId),
                urgency.latest(estateId, reportId));
    }

    private static ResidentReportException error(HttpStatus status, String message) {
        return new ResidentReportException(status, message);
    }
}
