package com.proj.server.storage;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** A short-lived link to one private file; use {@code url} directly as an image source or download link. */
@Schema(requiredProperties = {"url", "expiresAt"})
public record SignedDownloadResponse(String url, Instant expiresAt) {
    public static SignedDownloadResponse of(ObjectStorage.SignedUrl url) {
        return new SignedDownloadResponse(url.url(), url.expiresAt());
    }
}
