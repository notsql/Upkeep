package com.proj.server.inspection;

import com.proj.server.db.tables.records.AssetinspectionresultRecord;
import com.proj.server.resident.ResidentImageValidator;
import com.proj.server.workos.WorkOSService;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class InspectionService {
    private final InspectionRepository repository;
    private final ResidentImageValidator validator;
    private final InspectionImageStore images;
    private final TransactionTemplate transactions;
    private final WorkOSService identity;

    public InspectionService(
            InspectionRepository repository,
            ResidentImageValidator validator,
            InspectionImageStore images,
            TransactionTemplate transactions,
            WorkOSService identity) {
        this.repository = repository;
        this.validator = validator;
        this.images = images;
        this.transactions = transactions;
        this.identity = identity;
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

    public InspectionResultResponse create(
            UUID estate,
            String user,
            UUID asset,
            InspectionOutcome outcome,
            LocalDate date,
            String notes,
            UUID expectedLocation,
            List<MultipartFile> selected) {
        authorize(estate, user, true, false);
        writableAsset(estate, asset, expectedLocation, date);
        String text = notes == null || notes.isBlank() ? null : notes.trim();
        if (text != null && text.length() > 2000)
            throw error(HttpStatus.BAD_REQUEST, "Notes must be at most 2,000 trimmed characters.");
        var files = selected == null ? List.<MultipartFile>of() : selected;
        if (files.size() > 3) throw error(HttpStatus.BAD_REQUEST, "Choose at most three photos.");
        var validated = files.stream().map(validator::validate).toList();
        var name = identity.findDisplayName(user).orElse(null);
        var id = UUID.randomUUID();
        var uploaded = new ArrayList<UploadedPhoto>();
        try {
            for (var image : validated) {
                var photo = UUID.randomUUID();
                uploaded.add(new UploadedPhoto(
                        photo, images.upload(id, photo, image), image.contentType(), image.bytes().length));
            }
            return transactions.execute(ignored -> {
                authorize(estate, user, true, true);
                var current = writableAsset(estate, asset, expectedLocation, date);
                repository.create(id, current, outcome, date, text, user, name);
                for (var photo : uploaded)
                    repository.photo(photo.id(), estate, id, photo.key(), photo.type(), photo.size());
                return repository.response(repository.result(estate, id));
            });
        } catch (RuntimeException error) {
            for (var photo : uploaded) images.deleteQuietly(photo.key());
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

    public ImageBytes photo(UUID estate, String user, UUID asset, UUID resultId, UUID photoId) {
        authorize(estate, user, false, false);
        if (!result(estate, resultId).getAssetid().equals(asset))
            throw error(HttpStatus.NOT_FOUND, "Inspection photo not found.");
        var photo = repository.photo(estate, resultId, photoId);
        if (photo == null) throw error(HttpStatus.NOT_FOUND, "Inspection photo not found.");
        return new ImageBytes(images.read(photo.getStoragekey()), photo.getContenttype());
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

    public record ImageBytes(byte[] bytes, String contentType) {}

    private record UploadedPhoto(UUID id, String key, String type, int size) {}
}
