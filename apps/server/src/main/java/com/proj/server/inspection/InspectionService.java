package com.proj.server.inspection;

import com.proj.server.db.tables.records.AssetinspectionresultRecord;
import com.proj.server.inspectionlist.InspectionListRepository;
import com.proj.server.resident.ImageUploads;
import com.proj.server.storage.SignedDownloadResponse;
import com.proj.server.storage.UploadSlotResponse;
import com.proj.server.workos.WorkOSService;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class InspectionService {
    private final InspectionRepository repository;
    private final ImageUploads images;
    private final TransactionTemplate transactions;
    private final WorkOSService identity;
    private final InspectionListRepository checks;

    public InspectionService(
            InspectionRepository repository,
            ImageUploads images,
            TransactionTemplate transactions,
            WorkOSService identity,
            InspectionListRepository checks) {
        this.repository = repository;
        this.images = images;
        this.transactions = transactions;
        this.identity = identity;
        this.checks = checks;
    }

    private void authorize(UUID estateId, String user, boolean write, boolean lock) {
        var estate = repository.estate(estateId, lock);
        if (estate == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        String role = repository.role(estateId, user);
        boolean owner = user.equals(estate.getOwneruserid());
        if ("RESIDENT".equals(role) || !(owner || "MANAGER".equals(role) || "CREW".equals(role)))
            throw error(
                    owner || role != null ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND,
                    owner || role != null
                            ? "Inspection access is unavailable for this membership."
                            : "Estate not found.");
        if (write && estate.getDeactivatedat() != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
    }

    public InspectionAssetResponse asset(UUID estate, String user, UUID asset) {
        authorize(estate, user, false, false);
        return requireAsset(estate, asset);
    }

    private InspectionAssetResponse requireAsset(UUID estate, UUID asset) {
        var context = repository.asset(estate, asset);
        if (context == null) throw error(HttpStatus.NOT_FOUND, "Asset not found.");
        return context;
    }

    private InspectionAssetResponse writableAsset(UUID estate, UUID asset, UUID expectedLocation, LocalDate date) {
        var context = requireAsset(estate, asset);
        if (!context.estateActive() || !context.assetActive() || !context.locationActive())
            throw error(HttpStatus.CONFLICT, "The estate, asset or location is inactive or retired.");
        if (!context.locationId().equals(expectedLocation))
            throw error(HttpStatus.CONFLICT, "The asset location changed. Refresh and review before saving.");
        if (date == null
                || date.isAfter(LocalDate.now(ZoneId.of("Asia/Singapore")))
                || (context.installedOn() != null && date.isBefore(context.installedOn())))
            throw error(HttpStatus.BAD_REQUEST, "Use a Singapore inspection date between installation and today.");
        return context;
    }

    /** A signed upload for one inspection photo; later photos pass the returned inspection id back. */
    public UploadSlotResponse photoSlot(
            UUID estate, String user, UUID asset, UUID inspectionId, String contentType, long size) {
        authorize(estate, user, true, false);
        var context = requireAsset(estate, asset);
        if (!context.estateActive() || !context.assetActive() || !context.locationActive())
            throw error(HttpStatus.CONFLICT, "The estate, asset or location is inactive or retired.");
        var id = inspectionId == null ? UUID.randomUUID() : inspectionId;
        return images.slot(prefix(id), contentType, size).forInspection(id);
    }

    public InspectionResultResponse create(
            UUID estate,
            String user,
            UUID asset,
            UUID requestedId,
            InspectionOutcome outcome,
            LocalDate date,
            String notes,
            UUID expectedLocation,
            List<String> photoKeys) {
        authorize(estate, user, true, false);
        writableAsset(estate, asset, expectedLocation, date);
        String text = notes == null || notes.isBlank() ? null : notes.trim();
        if (outcome == InspectionOutcome.FAIL && text == null)
            throw error(HttpStatus.BAD_REQUEST, "Say what's wrong so the manager knows what to fix.");
        if (text != null && text.length() > 2000)
            throw error(HttpStatus.BAD_REQUEST, "Notes must be at most 2,000 trimmed characters.");
        var keys = photoKeys == null ? List.<String>of() : photoKeys;
        if (keys.size() > 3) throw error(HttpStatus.BAD_REQUEST, "Choose at most three photos.");
        if (!keys.isEmpty() && requestedId == null)
            throw error(HttpStatus.BAD_REQUEST, "A photo was not uploaded properly. Add it again and resubmit.");
        var id = requestedId == null ? UUID.randomUUID() : requestedId;
        var ids = images.requireIssued(prefix(id), keys, repository::hasStorageKey);
        var name = identity.findDisplayName(user).orElse(null);
        var uploaded = images.confirm(keys, ids);
        try {
            return transactions.execute(ignored -> {
                authorize(estate, user, true, true);
                var current = writableAsset(estate, asset, expectedLocation, date);
                repository.create(id, current, outcome, date, text, user, name);
                // The asset's open monthly check, if any, is done (ID-84).
                checks.complete(asset, id);
                if (outcome == InspectionOutcome.FAIL) checks.notifyFailed(estate, asset, id, summary(text));
                for (var photo : uploaded)
                    repository.photo(photo.id(), estate, id, photo.key(), photo.contentType(), photo.size());
                return repository.response(repository.result(estate, id));
            });
        } catch (RuntimeException error) {
            images.deleteQuietly(keys);
            throw error;
        }
    }

    public InspectionResultResponse detail(UUID estate, String user, UUID asset, UUID id) {
        authorize(estate, user, false, false);
        var result = result(estate, id);
        if (!result.getAssetid().equals(asset)) throw error(HttpStatus.NOT_FOUND, "Inspection not found.");
        return repository.response(result);
    }

    public InspectionResultResponse source(UUID estate, String user, UUID id) {
        authorize(estate, user, false, false);
        return repository.response(result(estate, id));
    }

    private AssetinspectionresultRecord result(UUID estate, UUID id) {
        var result = repository.result(estate, id);
        if (result == null) throw error(HttpStatus.NOT_FOUND, "Inspection not found.");
        return result;
    }

    public InspectionResultPageResponse list(UUID estate, String user, UUID asset, String cursor, Integer requested) {
        authorize(estate, user, false, false);
        requireAsset(estate, asset);
        int limit = limit(requested);
        UUID after = decode(cursor, "results|" + estate + "|" + asset);
        var row = after == null ? null : repository.result(estate, after);
        if (after != null && (row == null || !row.getAssetid().equals(asset))) throw invalidCursor();
        var found = repository.results(estate, asset, row, limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        return new InspectionResultPageResponse(
                page.stream().map(repository::response).toList(),
                found.size() > limit
                        ? encode(
                                "results|" + estate + "|" + asset,
                                page.getLast().getId())
                        : null);
    }

    public InspectionAssetPageResponse assets(
            UUID estate, String user, String query, String cursor, Integer requested) {
        authorize(estate, user, false, false);
        if (query != null && query.length() > 200)
            throw error(HttpStatus.BAD_REQUEST, "Search must be at most 200 characters.");
        int limit = limit(requested);
        UUID after = decode(cursor, "assets|" + estate);
        var row = after == null ? null : repository.asset(estate, after);
        if (after != null && row == null) throw invalidCursor();
        var found = repository.assets(estate, query == null ? null : query.trim(), row, limit + 1);
        var page = found.size() > limit ? found.subList(0, limit) : found;
        return new InspectionAssetPageResponse(
                page,
                found.size() > limit ? encode("assets|" + estate, page.getLast().id()) : null);
    }

    public SignedDownloadResponse photo(UUID estate, String user, UUID asset, UUID resultId, UUID photoId) {
        authorize(estate, user, false, false);
        if (!result(estate, resultId).getAssetid().equals(asset))
            throw error(HttpStatus.NOT_FOUND, "Inspection photo not found.");
        var photo = repository.photo(estate, resultId, photoId);
        if (photo == null) throw error(HttpStatus.NOT_FOUND, "Inspection photo not found.");
        return images.download(photo.getStoragekey(), photo.getContenttype());
    }

    /** Removes inspection photos uploaded more than a day ago but never saved with a result. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
    public synchronized void cleanupOrphans() {
        images.sweep("inspections/", repository::hasStorageKey);
    }

    private static String prefix(UUID inspectionId) {
        return "inspections/" + inspectionId + "/";
    }

    /** The inspector's note, shortened to fit a notification. */
    private static String summary(String note) {
        return note.length() <= 300 ? note : note.substring(0, 299) + "\u2026";
    }

    private static int limit(Integer requested) {
        int value = requested == null ? 20 : requested;
        if (value < 1 || value > 50) throw error(HttpStatus.BAD_REQUEST, "Limit must be between 1 and 50.");
        return value;
    }

    private static String encode(String scope, UUID id) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString((scope + "|" + id).getBytes(StandardCharsets.UTF_8));
    }

    private static UUID decode(String cursor, String scope) {
        if (cursor == null) return null;
        try {
            if (cursor.length() > 2048) throw new IllegalArgumentException();
            String value = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            if (!value.startsWith(scope + "|")) throw new IllegalArgumentException();
            return UUID.fromString(value.substring(scope.length() + 1));
        } catch (RuntimeException invalid) {
            throw invalidCursor();
        }
    }

    private static InspectionException invalidCursor() {
        return error(HttpStatus.BAD_REQUEST, "Invalid or mismatched inspection cursor.");
    }

    private static InspectionException error(HttpStatus status, String message) {
        return new InspectionException(status, message);
    }
}
