package com.proj.server.resident;

import com.proj.server.storage.ObjectStorage;
import com.proj.server.storage.SignedDownloadResponse;
import com.proj.server.storage.StorageUnavailableException;
import com.proj.server.storage.UploadSlotResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Photos sent straight to storage by the browser, for fault reports ({@code reports/{reportId}/}) and inspections
 * ({@code inspections/{inspectionId}/}). Spring issues the slot, then checks and cleans each photo before its row is
 * written (decision 0050).
 */
@Component
public class ImageUploads {
    static final Duration UPLOAD_TTL = Duration.ofMinutes(10);
    static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);
    private final ObjectStorage storage;
    private final ResidentImageValidator validator;

    public ImageUploads(ObjectStorage storage, ResidentImageValidator validator) {
        this.storage = storage;
        this.validator = validator;
    }

    /** A signed upload for one photo under {@code prefix} (which ends in "/"). */
    public UploadSlotResponse slot(String prefix, String declaredType, long size) {
        String type = validator.acceptedType(declaredType);
        validator.checkSize(size);
        String key = prefix + UUID.randomUUID();
        return UploadSlotResponse.of(
                key,
                type,
                ResidentImageValidator.MAX_BYTES,
                storage.signUpload(key, type, ResidentImageValidator.MAX_BYTES, UPLOAD_TTL));
    }

    /**
     * Rejects, without touching storage, any key that was not issued under {@code prefix} or that a row already
     * uses. Returns the photo ids carried in the keys.
     */
    public List<UUID> requireIssued(String prefix, List<String> keys, Predicate<String> alreadyUsed) {
        var ids = new ArrayList<UUID>();
        for (var key : keys) {
            UUID id = null;
            if (key != null && key.startsWith(prefix)) {
                try {
                    id = UUID.fromString(key.substring(prefix.length()));
                } catch (IllegalArgumentException ignored) {
                    // Not a key Spring issued.
                }
            }
            if (id == null || !key.equals(prefix + id) || ids.contains(id) || alreadyUsed.test(key))
                throw new ResidentReportException(
                        HttpStatus.BAD_REQUEST, "A photo was not uploaded properly. Add it again and resubmit.");
            ids.add(id);
        }
        return ids;
    }

    /**
     * Checks each uploaded photo's size, type and pixels, and replaces it with a clean copy. On any failure every
     * photo in {@code keys} is deleted.
     */
    public List<Confirmed> confirm(List<String> keys, List<UUID> ids) {
        var confirmed = new ArrayList<Confirmed>();
        try {
            for (int i = 0; i < keys.size(); i++) {
                var key = keys.get(i);
                var metadata = storage.metadata(key).orElseThrow(ImageUploads::missing);
                validator.checkSize(metadata.size());
                validator.acceptedType(metadata.contentType());
                var object = storage.get(key).orElseThrow(ImageUploads::missing);
                var clean = validator.validate(object.contentType(), object.bytes());
                storage.put(key, clean.bytes(), clean.contentType());
                confirmed.add(new Confirmed(ids.get(i), key, clean.contentType(), clean.bytes().length));
            }
            return confirmed;
        } catch (RuntimeException error) {
            deleteQuietly(keys);
            throw error;
        }
    }

    public void deleteQuietly(List<String> keys) {
        for (var key : keys) storage.delete(key);
    }

    public SignedDownloadResponse download(String key, String contentType) {
        return SignedDownloadResponse.of(storage.signDownload(key, DOWNLOAD_TTL, contentType, null));
    }

    public byte[] read(String key) {
        return storage.get(key)
                .orElseThrow(() -> new StorageUnavailableException("Stored photo is missing: " + key, null))
                .bytes();
    }

    /** Deletes objects under {@code prefix} older than a day that no row references. */
    public void sweep(String prefix, Predicate<String> referenced) {
        var cutoff = Instant.now().minus(Duration.ofHours(24));
        try {
            for (var object : storage.list(prefix))
                if (object.lastModified().isBefore(cutoff) && !referenced.test(object.key()))
                    storage.delete(object.key());
        } catch (StorageUnavailableException ignored) {
            // The next hourly sweep retries.
        }
    }

    private static ResidentReportException missing() {
        return new ResidentReportException(
                HttpStatus.BAD_REQUEST, "A photo was not uploaded properly. Add it again and resubmit.");
    }

    public record Confirmed(UUID id, String key, String contentType, int size) {}
}
