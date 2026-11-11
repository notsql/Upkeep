package com.proj.server.storage;

import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * {@link ObjectStorage} on Google Cloud Storage, authenticated by an inline service-account key when
 * {@code app.storage.credentials-json} is set (local dev), else Application Default Credentials. On Cloud Run
 * signing goes through IAM signBlob, so the runtime account needs Token Creator on itself (decision 0050). The
 * client is built on first use, so missing credentials answer 503 instead of stopping the app.
 */
@Component
public class GcsObjectStorage implements ObjectStorage {
    private final String bucket;
    private final Supplier<Storage> factory;
    private final Clock clock;
    private volatile Storage client;

    @Autowired
    public GcsObjectStorage(
            @Value("${app.storage.bucket:}") String bucket,
            @Value("${app.storage.project-id:}") String projectId,
            @Value("${app.storage.credentials-json:}") String credentialsJson,
            Clock clock) {
        this(bucket, () -> options(projectId, credentialsJson).getService(), clock);
    }

    GcsObjectStorage(String bucket, Supplier<Storage> factory, Clock clock) {
        this.bucket = bucket == null ? "" : bucket.trim();
        this.factory = factory;
        this.clock = clock;
    }

    static StorageOptions options(String projectId, String credentialsJson) {
        var options = StorageOptions.newBuilder();
        if (projectId != null && !projectId.isBlank()) options.setProjectId(projectId);
        var json = credentialsJson == null ? "" : credentialsJson.trim();
        if (!json.isEmpty()) {
            try {
                options.setCredentials(ServiceAccountCredentials.fromStream(
                        new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8))));
            } catch (IOException error) {
                throw new UncheckedIOException("Storage credentials are not a valid service-account key.", error);
            }
        }
        return options.build();
    }

    @Override
    public boolean configured() {
        return !bucket.isEmpty();
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        call(() -> client().create(
                        BlobInfo.newBuilder(id(key)).setContentType(contentType).build(), bytes));
    }

    @Override
    public Optional<StoredObject> get(String key) {
        return call(() -> {
            var blob = client().get(id(key));
            return blob == null
                    ? Optional.<StoredObject>empty()
                    : Optional.of(new StoredObject(blob.getContent(), blob.getContentType()));
        });
    }

    @Override
    public Optional<ObjectMetadata> metadata(String key) {
        return call(() -> {
            var blob = client().get(id(key));
            return blob == null
                    ? Optional.<ObjectMetadata>empty()
                    : Optional.of(new ObjectMetadata(blob.getSize(), blob.getContentType()));
        });
    }

    @Override
    public boolean delete(String key) {
        if (!configured()) return false;
        try {
            client().delete(id(key)); // false means it was already gone, which counts as deleted.
            return true;
        } catch (RuntimeException error) {
            return false;
        }
    }

    @Override
    public List<ListedObject> list(String prefix) {
        if (!configured()) return List.of();
        return call(() -> {
            var found = new ArrayList<ListedObject>();
            for (var blob :
                    client().list(bucket, Storage.BlobListOption.prefix(prefix)).iterateAll()) {
                var updated = blob.getUpdateTimeOffsetDateTime();
                if (updated != null) found.add(new ListedObject(blob.getName(), updated.toInstant()));
            }
            return found;
        });
    }

    @Override
    public SignedUrl signUpload(String key, String contentType, long maxBytes, Duration ttl) {
        var headers = new LinkedHashMap<String, String>();
        headers.put("Content-Type", contentType);
        headers.put("x-goog-content-length-range", "0," + maxBytes);
        return sign(
                key,
                ttl,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withV4Signature(),
                Storage.SignUrlOption.withExtHeaders(headers));
    }

    @Override
    public SignedUrl signDownload(String key, Duration ttl, String contentType, String disposition) {
        var query = new LinkedHashMap<String, String>();
        if (contentType != null) query.put("response-content-type", contentType);
        if (disposition != null) query.put("response-content-disposition", disposition);
        return sign(
                key,
                ttl,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
                Storage.SignUrlOption.withV4Signature(),
                Storage.SignUrlOption.withQueryParams(query));
    }

    private SignedUrl sign(String key, Duration ttl, Storage.SignUrlOption... options) {
        var expires = clock.instant().plus(ttl);
        var url = call(() ->
                client().signUrl(BlobInfo.newBuilder(id(key)).build(), ttl.toSeconds(), TimeUnit.SECONDS, options));
        return new SignedUrl(url.toString(), expires);
    }

    private BlobId id(String key) {
        return BlobId.of(bucket, key);
    }

    private Storage client() {
        if (!configured()) throw new StorageUnavailableException("Storage bucket is not configured.", null);
        var current = client;
        if (current == null) {
            synchronized (this) {
                if (client == null) client = factory.get();
                current = client;
            }
        }
        return current;
    }

    /** Any provider, credential or signing failure is "temporarily unavailable", never a 500. */
    private static <T> T call(Supplier<T> action) {
        try {
            return action.get();
        } catch (StorageUnavailableException error) {
            throw error;
        } catch (RuntimeException error) {
            throw new StorageUnavailableException("Storage request failed.", error);
        }
    }
}
