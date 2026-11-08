package com.proj.server.report;

import com.proj.server.resident.ResidentReportException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import org.springframework.http.HttpStatus;

public record ReportQueueCursor(boolean isSafety, int rank, OffsetDateTime createdAt, UUID id) {
    public static String scope(
            UUID estate, UUID location, UUID block, Integer min, Integer max, boolean openOnly, ReportSort sort) {
        return "queue-v2|" + estate + "|" + location + "|" + block + "|" + min + "|" + max + "|" + openOnly + "|"
                + sort.name();
    }

    public String encode(String scope) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString((scope + "|" + isSafety + "|" + rank + "|" + createdAt + "|" + id)
                        .getBytes(StandardCharsets.UTF_8));
    }

    public static ReportQueueCursor decode(String encoded, String scope) {
        if (encoded == null) return null;
        try {
            if (encoded.length() > 2048) throw new IllegalArgumentException();
            var value = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
            if (!value.startsWith(scope + "|")) throw new IllegalArgumentException();
            var parts = value.substring(scope.length() + 1).split("\\|", -1);
            if (parts.length != 4 || !(parts[0].equals("true") || parts[0].equals("false")))
                throw new IllegalArgumentException();
            int rank = Integer.parseInt(parts[1]);
            if (rank < 0 || rank > 3) throw new IllegalArgumentException();
            return new ReportQueueCursor(
                    Boolean.parseBoolean(parts[0]), rank, OffsetDateTime.parse(parts[2]), UUID.fromString(parts[3]));
        } catch (RuntimeException invalid) {
            throw new ResidentReportException(
                    HttpStatus.BAD_REQUEST, "Invalid or mismatched report cursor. Reload the first page.");
        }
    }
}
