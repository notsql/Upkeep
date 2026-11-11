package com.proj.server.storage;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageException;
import java.net.URI;
import java.security.KeyPairGenerator;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class GcsObjectStorageTests {
    private static final Instant NOW = Instant.parse("2026-11-11T02:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    private final Storage client = mock(Storage.class);
    private final GcsObjectStorage storage = new GcsObjectStorage("bucket", () -> client, clock);

    @Test
    void aBlankBucketMeansStorageIsNotConfigured() {
        var blank = new GcsObjectStorage(" ", () -> fail("no client without a bucket"), clock);

        assertFalse(blank.configured());
        assertThrows(StorageUnavailableException.class, () -> blank.get("documents/a/b"));
        assertThrows(
                StorageUnavailableException.class,
                () -> blank.signUpload("documents/a/b", "application/pdf", 10, Duration.ofMinutes(10)));
        assertFalse(blank.delete("documents/a/b"), "deletes do nothing while storage is off");
        assertEquals(List.of(), blank.list("documents/"), "sweeps see nothing while storage is off");
    }

    @Test
    void anUploadUrlIsAV4PutSignedOverTheContentTypeAndSizeLimit() throws Exception {
        when(client.signUrl(any(), anyLong(), any(), any(Storage.SignUrlOption[].class)))
                .thenReturn(URI.create("https://storage.googleapis.com/bucket/k?sig")
                        .toURL());

        var signed = storage.signUpload("reports/r/i", "image/png", 5_242_880, Duration.ofMinutes(10));

        assertEquals("https://storage.googleapis.com/bucket/k?sig", signed.url());
        assertEquals(NOW.plus(Duration.ofMinutes(10)), signed.expiresAt());
        var info = ArgumentCaptor.forClass(BlobInfo.class);
        var options = ArgumentCaptor.forClass(Storage.SignUrlOption[].class);
        verify(client).signUrl(info.capture(), eq(600L), eq(TimeUnit.SECONDS), options.capture());
        assertEquals(BlobId.of("bucket", "reports/r/i"), info.getValue().getBlobId());
        var sent = described(options.getAllValues());
        assertTrue(sent.contains(describe(Storage.SignUrlOption.httpMethod(HttpMethod.PUT))), sent.toString());
        assertTrue(sent.contains(describe(Storage.SignUrlOption.withV4Signature())), sent.toString());
        assertTrue(
                sent.contains(describe(Storage.SignUrlOption.withExtHeaders(
                        Map.of("Content-Type", "image/png", "x-goog-content-length-range", "0,5242880")))),
                sent.toString());
    }

    @Test
    void aDownloadUrlCarriesTheResponseTypeAndDisposition() throws Exception {
        when(client.signUrl(any(), anyLong(), any(), any(Storage.SignUrlOption[].class)))
                .thenReturn(URI.create("https://storage.googleapis.com/bucket/k?sig")
                        .toURL());

        var signed = storage.signDownload(
                "documents/e/d", Duration.ofMinutes(5), "application/pdf", "attachment; filename=\"a.pdf\"");

        assertEquals(NOW.plus(Duration.ofMinutes(5)), signed.expiresAt());
        var options = ArgumentCaptor.forClass(Storage.SignUrlOption[].class);
        verify(client).signUrl(any(), eq(300L), eq(TimeUnit.SECONDS), options.capture());
        var sent = described(options.getAllValues());
        assertTrue(sent.contains(describe(Storage.SignUrlOption.httpMethod(HttpMethod.GET))), sent.toString());
        assertTrue(
                sent.contains(describe(Storage.SignUrlOption.withQueryParams(Map.of(
                        "response-content-type", "application/pdf",
                        "response-content-disposition", "attachment; filename=\"a.pdf\"")))),
                sent.toString());
    }

    @Test
    void aSigningFailureIsStorageUnavailableNotAServerError() {
        when(client.signUrl(any(), anyLong(), any(), any(Storage.SignUrlOption[].class)))
                .thenThrow(new IllegalStateException("Signing key was not provided"));

        assertThrows(
                StorageUnavailableException.class,
                () -> storage.signDownload("documents/e/d", Duration.ofMinutes(5), "application/pdf", null));
    }

    @Test
    void deletingAMissingObjectCountsAsSuccessAndAProviderErrorDoesNot() {
        when(client.delete(BlobId.of("bucket", "gone"))).thenReturn(false);
        when(client.delete(BlobId.of("bucket", "down"))).thenThrow(new StorageException(503, "down"));

        assertTrue(storage.delete("gone"));
        assertFalse(storage.delete("down"));
    }

    @Test
    void aMissingObjectHasNoMetadataAndAProviderErrorIsUnavailable() {
        when(client.get(BlobId.of("bucket", "missing"))).thenReturn(null);
        when(client.get(BlobId.of("bucket", "down"))).thenThrow(new StorageException(503, "down"));

        assertTrue(storage.metadata("missing").isEmpty());
        assertThrows(StorageUnavailableException.class, () -> storage.metadata("down"));
    }

    @Test
    void anInlineServiceAccountKeyBecomesTheClientCredentials() throws Exception {
        var key = KeyPairGenerator.getInstance("RSA");
        key.initialize(2048);
        var pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes())
                        .encodeToString(key.generateKeyPair().getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";
        var json = "\n  {\"type\": \"service_account\", \"project_id\": \"p\", \"private_key_id\": \"k\","
                + " \"private_key\": \"" + pem.replace("\n", "\\n") + "\","
                + " \"client_email\": \"sa@p.iam.gserviceaccount.com\", \"client_id\": \"1\","
                + " \"token_uri\": \"https://oauth2.googleapis.com/token\"}\n";

        var credentials = GcsObjectStorage.options("", json).getCredentials();

        var account = assertInstanceOf(ServiceAccountCredentials.class, credentials);
        assertEquals("sa@p.iam.gserviceaccount.com", account.getClientEmail());
    }

    @Test
    void aMalformedInlineKeyAnswersUnavailableInsteadOfFailingStartup() {
        var broken = new GcsObjectStorage("bucket", "", "{not json", clock);

        assertThrows(StorageUnavailableException.class, () -> broken.get("documents/a/b"));
    }

    /** SignUrlOption has no equals, so compare each option's name and value. */
    private static List<String> described(List<Storage.SignUrlOption[]> calls) {
        return calls.stream()
                .flatMap(Arrays::stream)
                .map(GcsObjectStorageTests::describe)
                .toList();
    }

    private static String describe(Storage.SignUrlOption option) {
        try {
            var name = Storage.SignUrlOption.class.getDeclaredMethod("getOption");
            var value = Storage.SignUrlOption.class.getDeclaredMethod("getValue");
            name.setAccessible(true);
            value.setAccessible(true);
            var raw = value.invoke(option);
            // Map.of iterates in a per-JVM random order, so compare map values by sorted key.
            var normalised = raw instanceof Map<?, ?> map ? new TreeMap<>(map) : raw;
            return name.invoke(option) + "=" + normalised;
        } catch (ReflectiveOperationException error) {
            throw new IllegalStateException(error);
        }
    }
}
