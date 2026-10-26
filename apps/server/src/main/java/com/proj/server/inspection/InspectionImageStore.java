package com.proj.server.inspection;

import com.proj.server.resident.ResidentImageValidator;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
public class InspectionImageStore {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(InspectionImageStore.class);
    private final S3Client client;
    private final String bucket;
    private final InspectionRepository repository;
    private String cleanupCursor;

    public InspectionImageStore(
            @Value("${app.r2.endpoint:}") String endpoint,
            @Value("${app.r2.access-id:}") String accessId,
            @Value("${app.r2.secret-access-key:}") String secret,
            @Value("${app.r2.bucket-name:}") String bucket,
            InspectionRepository repository) {
        this.bucket = bucket;
        this.repository = repository;
        this.client = endpoint.isBlank() || accessId.isBlank() || secret.isBlank() || bucket.isBlank()
                ? null
                : S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .region(Region.of("auto"))
                        .credentialsProvider(
                                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessId, secret)))
                        .serviceConfiguration(S3Configuration.builder()
                                .pathStyleAccessEnabled(true)
                                .build())
                        .build();
    }

    public String upload(UUID inspectionId, UUID imageId, ResidentImageValidator.ValidatedImage image) {
        var key = "inspections/" + inspectionId + "/" + imageId;
        try {
            requireClient()
                    .putObject(
                            PutObjectRequest.builder()
                                    .bucket(bucket)
                                    .key(key)
                                    .contentType(image.contentType())
                                    .contentLength((long) image.bytes().length)
                                    .build(),
                            RequestBody.fromBytes(image.bytes()));
            return key;
        } catch (SdkException error) {
            throw unavailable();
        }
    }

    public byte[] read(String key) {
        try {
            ResponseBytes<GetObjectResponse> result = requireClient()
                    .getObjectAsBytes(
                            GetObjectRequest.builder().bucket(bucket).key(key).build());
            return result.asByteArray();
        } catch (SdkException error) {
            throw unavailable();
        }
    }

    public void deleteQuietly(String key) {
        if (client == null) {
            return;
        }
        try {
            client.deleteObject(
                    DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (SdkException ignored) {
            LOG.warn("Inspection evidence cleanup failed; the orphan sweep will retry.");
        }
    }

    /** Examine at most 500 objects per run; delete only old keys absent from inspection metadata. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
    public synchronized void cleanupOrphans() {
        if (client == null) {
            return;
        }
        var cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
        try {
            for (int page = 0; page < 5; page++) {
                var result = client.listObjectsV2(ListObjectsV2Request.builder()
                        .bucket(bucket)
                        .prefix("inspections/")
                        .continuationToken(cleanupCursor)
                        .maxKeys(100)
                        .build());
                List<String> oldKeys = new ArrayList<>();
                for (var object : result.contents()) {
                    if (object.lastModified().isBefore(cutoff) && !repository.hasStorageKey(object.key())) {
                        oldKeys.add(object.key());
                    }
                }
                for (var key : oldKeys) {
                    deleteQuietly(key);
                }
                cleanupCursor = result.nextContinuationToken();
                if (cleanupCursor == null) {
                    return;
                }
            }
        } catch (SdkException ignored) {
            LOG.warn("Inspection evidence orphan sweep is temporarily unavailable; it will retry.");
        }
    }

    private S3Client requireClient() {
        if (client == null) {
            throw unavailable();
        }
        return client;
    }

    private static InspectionException unavailable() {
        return new InspectionException(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Image storage is temporarily unavailable.");
    }
}
