package com.proj.server.assethistory;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class AssetHistoryCursor {
    private AssetHistoryCursor() {}

    static String encode(String... parts) {
        return String.join(
                ".",
                Arrays.stream(parts)
                        .map(part -> Base64.getUrlEncoder()
                                .withoutPadding()
                                .encodeToString(part.getBytes(StandardCharsets.UTF_8)))
                        .toList());
    }

    static String[] decode(String cursor, int values, String... binding) {
        try {
            if (cursor.length() > 4096) throw invalid();
            var parts = Arrays.stream(cursor.split("\\.", -1))
                    .map(part -> new String(Base64.getUrlDecoder().decode(part), StandardCharsets.UTF_8))
                    .toArray(String[]::new);
            if (parts.length != binding.length + values) throw invalid();
            for (int i = 0; i < binding.length; i++) if (!binding[i].equals(parts[i])) throw invalid();
            return Arrays.copyOfRange(parts, binding.length, parts.length);
        } catch (IllegalArgumentException error) {
            throw invalid();
        }
    }

    static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid history cursor or page parameters.");
    }
}
