package com.proj.server.resident;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ResidentReportService {
    private final ResidentReportRepository reports;
    private final ResidentImageValidator validator;
    private final ResidentImageStore images;
    private final TransactionTemplate transactions;

    public ResidentReportService(
            ResidentReportRepository reports,
            ResidentImageValidator validator,
            ResidentImageStore images,
            TransactionTemplate transactions) {
        this.reports = reports;
        this.validator = validator;
        this.images = images;
        this.transactions = transactions;
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

    public IssueReportDetailResponse create(
            String userId,
            UUID estateId,
            String title,
            String description,
            UUID locationId,
            List<MultipartFile> selectedImages) {
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
        var files = selectedImages == null ? List.<MultipartFile>of() : selectedImages;
        if (files.size() > 3) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Choose at most three images.");
        }
        var validated = files.stream().map(validator::validate).toList();
        var reportId = UUID.randomUUID();
        var uploaded = new ArrayList<UploadedImage>();
        try {
            for (var image : validated) {
                var imageId = UUID.randomUUID();
                var key = images.upload(reportId, imageId, image);
                uploaded.add(new UploadedImage(imageId, key, image.contentType(), image.bytes().length));
            }
            var created = transactions.execute(ignored -> {
                var current = reports.activeAssignment(userId, estateId, true)
                        .orElseThrow(() ->
                                new ResidentReportException(HttpStatus.FORBIDDEN, "No active estate assignment."));
                if (!current.id().equals(estate.id()) || !reports.activeReportLocation(current.id(), locationId)) {
                    throw new ResidentReportException(
                            HttpStatus.BAD_REQUEST, "The assignment or location changed. Reload and try again.");
                }
                reports.create(reportId, userId, current.id(), locationId, reportTitle, description.trim());
                for (var image : uploaded) {
                    reports.addImage(image.id(), reportId, image.key(), image.contentType(), image.size());
                }
                return reports.detail(userId, reportId).orElseThrow();
            });
            return created;
        } catch (RuntimeException error) {
            for (var image : uploaded) {
                images.deleteQuietly(image.key());
            }
            throw error;
        }
    }

    public IssueReportPageResponse list(String userId, String cursor, Integer requestedLimit) {
        int limit = requestedLimit == null ? 20 : requestedLimit;
        if (limit < 1 || limit > 50) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Limit must be between 1 and 50.");
        }
        OffsetDateTime time = null;
        UUID id = null;
        if (cursor != null) {
            try {
                var decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                var separator = decoded.lastIndexOf('|');
                time = OffsetDateTime.parse(decoded.substring(0, separator));
                id = UUID.fromString(decoded.substring(separator + 1));
            } catch (RuntimeException error) {
                throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Invalid report cursor.");
            }
        }
        var found = reports.list(userId, time, id, limit + 1);
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

    public IssueReportDetailResponse detail(String userId, UUID reportId) {
        return reports.detail(userId, reportId)
                .orElseThrow(() -> new ResidentReportException(HttpStatus.NOT_FOUND, "Report not found."));
    }

    public ImageBytes image(String userId, UUID reportId, UUID imageId) {
        var stored = reports.image(userId, reportId, imageId)
                .orElseThrow(() -> new ResidentReportException(HttpStatus.NOT_FOUND, "Report image not found."));
        return new ImageBytes(images.read(stored.key()), stored.contentType());
    }

    public record ImageBytes(byte[] bytes, String contentType) {}

    private record UploadedImage(UUID id, String key, String contentType, int size) {}
}
