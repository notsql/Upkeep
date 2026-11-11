package com.proj.server.storage;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Where the browser sends one file. PUT it to {@code uploadUrl} with {@code Content-Type: contentType} and {@code
 * x-goog-content-length-range: 0,<maxBytes>}, then pass {@code objectKey} to the create call.
 */
@Schema(requiredProperties = {"objectKey", "uploadUrl", "contentType", "maxBytes", "expiresAt"})
public record UploadSlotResponse(
        String objectKey,
        String uploadUrl,
        String contentType,
        long maxBytes,
        Instant expiresAt,

        @Schema(description = "Set on inspection photo slots; pass it to later slots and to the create call.")
        UUID inspectionId,

        @Schema(description = "Set on report image slots; pass it to later slots and to the create call.")
        UUID reportId) {
    public static UploadSlotResponse of(String key, String contentType, long maxBytes, ObjectStorage.SignedUrl url) {
        return new UploadSlotResponse(key, url.url(), contentType, maxBytes, url.expiresAt(), null, null);
    }

    public UploadSlotResponse forInspection(UUID id) {
        return new UploadSlotResponse(objectKey, uploadUrl, contentType, maxBytes, expiresAt, id, null);
    }

    public UploadSlotResponse forReport(UUID id) {
        return new UploadSlotResponse(objectKey, uploadUrl, contentType, maxBytes, expiresAt, null, id);
    }
}
