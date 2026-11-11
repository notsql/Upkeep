package com.proj.server.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Private file storage: one bucket, addressed by object key. No storage provider's types cross this boundary
 * (decision 0050). While storage is not configured, reads, writes and signing throw {@link
 * StorageUnavailableException}, and deletes and listings do nothing.
 */
public interface ObjectStorage {
    boolean configured();

    void put(String key, byte[] bytes, String contentType);

    Optional<StoredObject> get(String key);

    Optional<ObjectMetadata> metadata(String key);

    /** True when the object is gone afterwards, including when it never existed; false when storage is off or failed. */
    boolean delete(String key);

    /** Every object under the prefix, across all pages. */
    List<ListedObject> list(String prefix);

    /** A URL that accepts one PUT of the given content type, no larger than {@code maxBytes}. */
    SignedUrl signUpload(String key, String contentType, long maxBytes, Duration ttl);

    /** A URL that serves the object once; {@code disposition} may be null. */
    SignedUrl signDownload(String key, Duration ttl, String contentType, String disposition);

    record StoredObject(byte[] bytes, String contentType) {}

    record ObjectMetadata(long size, String contentType) {}

    record ListedObject(String key, Instant lastModified) {}

    record SignedUrl(String url, Instant expiresAt) {}
}
