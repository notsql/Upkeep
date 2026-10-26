package com.proj.server.report;

import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.resident.IssueReportDetailResponse;
import com.proj.server.resident.IssueReportPageResponse;
import com.proj.server.resident.ResidentImageStore;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.resident.ResidentReportRepository;
import com.proj.server.resident.ResidentReportService.ImageBytes;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
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

    public EstateReportService(
            EstateReportRepository repository, ResidentReportRepository reports, ResidentImageStore images) {
        this.repository = repository;
        this.reports = reports;
        this.images = images;
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

    public IssueReportPageResponse list(
            UUID estateId,
            String user,
            UUID locationId,
            UUID blockId,
            Integer minLevelPosition,
            Integer maxLevelPosition,
            String cursor,
            Integer requestedLimit) {
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
        OffsetDateTime time = null;
        UUID id = null;
        if (cursor != null) {
            try {
                var decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                var separator = decoded.lastIndexOf('|');
                time = OffsetDateTime.parse(decoded.substring(0, separator));
                id = UUID.fromString(decoded.substring(separator + 1));
            } catch (RuntimeException invalid) {
                throw error(HttpStatus.BAD_REQUEST, "Invalid report cursor.");
            }
        }
        var found = reports.estateList(
                estateId, locationId, blockId, minLevelPosition, maxLevelPosition, time, id, limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        String next = null;
        if (found.size() > limit) {
            var last = page.getLast();
            next = Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString((last.createdAt() + "|" + last.id()).getBytes(StandardCharsets.UTF_8));
        }
        return new IssueReportPageResponse(page, next);
    }

    public IssueReportDetailResponse detail(UUID estateId, String user, UUID reportId) {
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
    public IssueReportDetailResponse relocate(
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

    private IssueReportDetailResponse find(UUID estateId, UUID reportId) {
        return reports.estateDetail(estateId, reportId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Report not found."));
    }

    private static ResidentReportException error(HttpStatus status, String message) {
        return new ResidentReportException(status, message);
    }
}
