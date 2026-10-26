package com.proj.server.document;

import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
public class DocumentStore implements AutoCloseable {
    private final S3Client client;
    private final String bucket;

    public DocumentStore(
            @Value("${app.r2.endpoint:}") String endpoint,
            @Value("${app.r2.access-id:}") String accessId,
            @Value("${app.r2.secret-access-key:}") String secret,
            @Value("${app.r2.bucket-name:}") String bucket) {
        this.bucket = bucket;
        this.client = endpoint.isBlank() || accessId.isBlank() || secret.isBlank() || bucket.isBlank()
                ? null
                : S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .region(Region.of("auto"))
                        .credentialsProvider(
                                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessId, secret)))
                        .overrideConfiguration(ClientOverrideConfiguration.builder()
                                .apiCallTimeout(Duration.ofSeconds(30))
                                .apiCallAttemptTimeout(Duration.ofSeconds(10))
                                .build())
                        .serviceConfiguration(S3Configuration.builder()
                                .pathStyleAccessEnabled(true)
                                .build())
                        .build();
    }

    public void upload(String key, DocumentValidator.ValidatedDocument file) {
        try {
            requireClient()
                    .putObject(
                            request -> request.bucket(bucket)
                                    .key(key)
                                    .contentType(file.contentType())
                                    .contentLength((long) file.bytes().length),
                            RequestBody.fromBytes(file.bytes()));
        } catch (SdkException error) {
            throw unavailable();
        }
    }

    public byte[] read(String key) {
        try {
            return requireClient()
                    .getObjectAsBytes(request -> request.bucket(bucket).key(key))
                    .asByteArray();
        } catch (SdkException error) {
            throw unavailable();
        }
    }

    public boolean delete(String key) {
        if (client == null) return false;
        try {
            client.deleteObject(request -> request.bucket(bucket).key(key));
            return true;
        } catch (S3Exception error) {
            return error.statusCode() == 404;
        } catch (SdkException error) {
            return false;
        }
    }

    public ListObjectsV2Response list(String cursor) {
        try {
            return requireClient().listObjectsV2(request -> request.bucket(bucket)
                    .prefix("documents/")
                    .continuationToken(cursor)
                    .maxKeys(100));
        } catch (SdkException error) {
            throw unavailable();
        }
    }

    private S3Client requireClient() {
        if (client == null) throw unavailable();
        return client;
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE, "Document storage is temporarily unavailable.");
    }

    @Override
    public void close() {
        if (client != null) client.close();
    }
}
