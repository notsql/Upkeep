package com.proj.server.storage;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The one storage double for tests (decision 0050). {@link #unavailable} fails every operation the way an
 * unconfigured or unreachable bucket does; {@link #deletionUnavailable} fails only deletes. Signed URLs are readable
 * fake strings carrying the key, content type, size limit and expiry so tests can assert on them.
 */
public class InMemoryObjectStorage implements ObjectStorage {
    public final Map<String, Stored> objects = new ConcurrentHashMap<>();
    public volatile boolean unavailable;
    public volatile boolean deletionUnavailable;
    /** Every key a URL was signed for, so tests can show a refused request never reached storage. */
    public final List<String> signed = new java.util.concurrent.CopyOnWriteArrayList<>();

    public void reset() {
        objects.clear();
        signed.clear();
        unavailable = false;
        deletionUnavailable = false;
    }

    /** What the browser's PUT to an upload URL does. */
    public void upload(String key, byte[] bytes, String contentType) {
        objects.put(key, new Stored(bytes, contentType, Instant.now()));
    }

    public void age(String key, Instant modified) {
        var object = objects.get(key);
        objects.put(key, new Stored(object.bytes(), object.contentType(), modified));
    }

    @Override
    public boolean configured() {
        return !unavailable;
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        requireAvailable();
        upload(key, bytes, contentType);
    }

    @Override
    public Optional<StoredObject> get(String key) {
        requireAvailable();
        return Optional.ofNullable(objects.get(key)).map(o -> new StoredObject(o.bytes(), o.contentType()));
    }

    @Override
    public Optional<ObjectMetadata> metadata(String key) {
        requireAvailable();
        return Optional.ofNullable(objects.get(key)).map(o -> new ObjectMetadata(o.bytes().length, o.contentType()));
    }

    @Override
    public boolean delete(String key) {
        if (unavailable || deletionUnavailable) return false;
        objects.remove(key);
        return true;
    }

    @Override
    public List<ListedObject> list(String prefix) {
        if (unavailable) return List.of();
        return objects.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith(prefix))
                .map(entry -> new ListedObject(entry.getKey(), entry.getValue().modifiedAt()))
                .toList();
    }

    @Override
    public SignedUrl signUpload(String key, String contentType, long maxBytes, Duration ttl) {
        requireAvailable();
        signed.add(key);
        var expires = Instant.now().plus(ttl);
        return new SignedUrl(
                "memory://upload/" + key + "?contentType=" + encode(contentType) + "&maxBytes=" + maxBytes
                        + "&expiresAt=" + expires,
                expires);
    }

    @Override
    public SignedUrl signDownload(String key, Duration ttl, String contentType, String disposition) {
        requireAvailable();
        signed.add(key);
        var expires = Instant.now().plus(ttl);
        return new SignedUrl(
                "memory://download/" + key + "?contentType=" + encode(contentType) + "&disposition="
                        + encode(disposition) + "&expiresAt=" + expires,
                expires);
    }

    private void requireAvailable() {
        if (unavailable) throw new StorageUnavailableException("Test storage is unavailable.", null);
    }

    private static String encode(String value) {
        return value == null ? "" : URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record Stored(byte[] bytes, String contentType, Instant modifiedAt) {}
}
