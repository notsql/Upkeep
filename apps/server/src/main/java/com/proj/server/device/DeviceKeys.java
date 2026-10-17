package com.proj.server.device;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Device API keys (decision 0025): {@code upk_} plus 32 random bytes, base64url
 * without padding. Only the SHA-256 hex is stored; the key has 256 bits of
 * entropy, so a fast hash is enough.
 */
final class DeviceKeys {
    private static final String PREFIX = "upk_";
    private static final Pattern FORMAT = Pattern.compile("^upk_[A-Za-z0-9_-]{43}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private DeviceKeys() {}

    static String generate() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static boolean wellFormed(String key) {
        return FORMAT.matcher(key).matches();
    }

    static String hash(String key) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
