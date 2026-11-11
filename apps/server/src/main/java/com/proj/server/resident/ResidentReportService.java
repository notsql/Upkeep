package com.proj.server.resident;

import com.proj.server.report.DuplicateService;
import com.proj.server.routing.RoutingRepository;
import com.proj.server.storage.SignedDownloadResponse;
import com.proj.server.storage.UploadSlotResponse;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ResidentReportService {
    private final ResidentReportRepository reports;
    private final ImageUploads images;
    private final TransactionTemplate transactions;
    private final DuplicateService duplicates;
    private final RoutingRepository routing;

    public ResidentReportService(
            ResidentReportRepository reports,
            ImageUploads images,
            TransactionTemplate transactions,
            DuplicateService duplicates,
            RoutingRepository routing) {
        this.reports = reports;
        this.images = images;
        this.transactions = transactions;
        this.duplicates = duplicates;
        this.routing = routing;
    }

    public ResidentContextResponse context(String userId) {
        var estates = reports.activeAssignments(userId);
        return new ResidentContextResponse(estates, !estates.isEmpty());
    }

    public List<ResidentLocationResponse> locations(String userId, UUID estateId) {
        if (!reports.hasResidentMembership(userId)) {
            throw new ResidentReportException(HttpStatus.FORBIDDEN, "No resident estate assignment.");
        }
        return reports.activeAssignment(userId, estateId, false)
                .map(estate -> reports.activeLocations(estate.id()))
                .orElseThrow(() -> new ResidentReportException(
                        HttpStatus.FORBIDDEN, "No active resident assignment in the selected estate."));
    }

    /** A signed upload for one report photo; later photos pass the returned report id back. */
    public UploadSlotResponse imageSlot(String userId, UUID estateId, UUID reportId, String contentType, long size) {
        reports.activeAssignment(userId, estateId, false)
                .orElseThrow(() -> new ResidentReportException(HttpStatus.FORBIDDEN, "No active estate assignment."));
        var id = reportId == null ? UUID.randomUUID() : reportId;
        return images.slot(prefix(id), contentType, size).forReport(id);
    }

    public IssueReportDetailResponse create(
            String userId,
            UUID estateId,
            UUID requestedReportId,
            String title,
            String description,
            UUID locationId,
            List<String> imageKeys) {
        String reportTitle = title == null ? "" : title.trim();
        if (reportTitle.isBlank() || reportTitle.length() > 50) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Enter a title in 1 to 50 characters.");
        }
        if (description == null || description.isBlank() || description.length() > 2500) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Describe the fault in 1 to 2,500 characters.");
        }
        if (locationId == null) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Choose a level or common area.");
        }
        var estate = reports.activeAssignment(userId, estateId, false)
                .orElseThrow(() -> new ResidentReportException(HttpStatus.FORBIDDEN, "No active estate assignment."));
        if (!reports.activeReportLocation(estate.id(), locationId)) {
            throw new ResidentReportException(
                    HttpStatus.BAD_REQUEST, "Choose an active level or common area in your estate.");
        }
        var keys = imageKeys == null ? List.<String>of() : imageKeys;
        if (keys.size() > 3) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Choose at most three images.");
        }
        if (!keys.isEmpty() && requestedReportId == null) {
            throw new ResidentReportException(
                    HttpStatus.BAD_REQUEST, "A photo was not uploaded properly. Add it again and resubmit.");
        }
        var reportId = requestedReportId == null ? UUID.randomUUID() : requestedReportId;
        var ids = images.requireIssued(prefix(reportId), keys, reports::hasStorageKey);
        var uploaded = images.confirm(keys, ids);
        try {
            var created = transactions.execute(ignored -> {
                var current = reports.activeAssignment(userId, estateId, true)
                        .orElseThrow(() ->
                                new ResidentReportException(HttpStatus.FORBIDDEN, "No active estate assignment."));
                if (!current.id().equals(estate.id()) || !reports.activeReportLocation(current.id(), locationId)) {
                    throw new ResidentReportException(
                            HttpStatus.BAD_REQUEST, "The assignment or location changed. Reload and try again.");
                }
                var reportDescription = description.trim();
                reports.create(reportId, userId, current.id(), locationId, reportTitle, reportDescription);
                for (var image : uploaded) {
                    reports.addImage(image.id(), reportId, image.key(), image.contentType(), image.size());
                }
                duplicates.detect(current.id(), reportId, locationId, reportTitle, reportDescription);
                routing.queue(reportId, current.id());
                return reports.detail(userId, reportId).orElseThrow();
            });
            return created;
        } catch (RuntimeException error) {
            images.deleteQuietly(keys);
            throw error;
        }
    }

    public ResidentReportPageResponse list(String userId, UUID estateId, String cursor, Integer requestedLimit) {
        int limit = requestedLimit == null ? 20 : requestedLimit;
        if (limit < 1 || limit > 50) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Limit must be between 1 and 50.");
        }
        OffsetDateTime time = null;
        UUID id = null;
        String scope = estateId == null ? "all" : estateId.toString();
        if (cursor != null) {
            try {
                var decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                var parts = decoded.split("\\|", -1);
                if (parts.length == 4 && parts[0].equals("v1") && parts[1].equals(scope)) {
                    time = OffsetDateTime.parse(parts[2]);
                    id = UUID.fromString(parts[3]);
                } else if (parts.length == 2 && estateId == null) {
                    // Existing unfiltered history links remain usable.
                    time = OffsetDateTime.parse(parts[0]);
                    id = UUID.fromString(parts[1]);
                } else {
                    throw new IllegalArgumentException();
                }
            } catch (RuntimeException error) {
                throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Invalid report cursor.");
            }
        }
        var found = reports.list(userId, estateId, time, id, limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        String next = null;
        if (found.size() > limit) {
            var last = page.getLast();
            next = Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(("v1|" + scope + "|" + last.createdAt() + "|" + last.id())
                            .getBytes(StandardCharsets.UTF_8));
        }
        var byStatus = reports.statusCounts(userId, estateId);
        var counts = new ResidentReportPageResponse.ReportCounts(
                byStatus.getOrDefault("SUBMITTED", 0),
                byStatus.getOrDefault("ASSIGNED", 0) + byStatus.getOrDefault("IN_PROGRESS", 0),
                byStatus.getOrDefault("CLOSED", 0));
        return new ResidentReportPageResponse(page, next, counts);
    }

    public IssueReportDetailResponse detail(String userId, UUID reportId) {
        return reports.detail(userId, reportId)
                .orElseThrow(() -> new ResidentReportException(HttpStatus.NOT_FOUND, "Report not found."));
    }

    public SignedDownloadResponse image(String userId, UUID reportId, UUID imageId) {
        var stored = reports.image(userId, reportId, imageId)
                .orElseThrow(() -> new ResidentReportException(HttpStatus.NOT_FOUND, "Report image not found."));
        return images.download(stored.key(), stored.contentType());
    }

    /** Removes report photos uploaded more than a day ago but never submitted. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
    public synchronized void cleanupOrphans() {
        images.sweep("reports/", reports::hasStorageKey);
    }

    private static String prefix(UUID reportId) {
        return "reports/" + reportId + "/";
    }
}
