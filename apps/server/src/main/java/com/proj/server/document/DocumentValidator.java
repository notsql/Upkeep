package com.proj.server.document;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class DocumentValidator {
    public static final long MAX_BYTES = 5_000_000;

    /** Checks what the browser declares before it uploads: name, type and size. Returns the stored media type. */
    public Declared declared(String rawName, String contentType, long size) {
        String filename = filename(rawName);
        if (size < 1) throw bad("Choose a non-empty file containing at least one byte.");
        if (size > MAX_BYTES)
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Choose a file no larger than 5 MB.");
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        String media = switch (extension) {
            case "pdf" -> "application/pdf";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            default -> throw unsupported();
        };
        if (!media.equals(contentType)) throw unsupported();
        return new Declared(filename, media);
    }

    /** Checks the uploaded bytes match the declared type by signature, and that images decode. */
    public ValidatedDocument validate(String rawName, String contentType, byte[] bytes) {
        var declared = declared(rawName, contentType, bytes.length);
        String media = declared.contentType();
        byte[] signature = switch (media) {
            case "application/pdf" -> "%PDF-".getBytes(StandardCharsets.US_ASCII);
            case "image/jpeg" -> new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff};
            default -> new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10};
        };
        if (bytes.length < signature.length || !Arrays.equals(signature, Arrays.copyOf(bytes, signature.length)))
            throw unsupported();
        try {
            if (!media.equals("application/pdf")) validateImage(bytes);
        } catch (IOException error) {
            throw bad("The file could not be read. Choose a readable PDF, JPEG or PNG file.");
        }
        return new ValidatedDocument(declared.filename(), media, bytes);
    }

    private static String filename(String raw) {
        if (raw == null || raw.codePoints().anyMatch(Character::isISOControl))
            throw bad("Choose a file with a valid filename.");
        String filename = raw.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        if (filename.isBlank() || filename.length() > 255) throw bad("Choose a filename between 1 and 255 characters.");
        return filename;
    }

    private static void validateImage(byte[] bytes) throws IOException {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw bad("The image could not be decoded. Choose a readable JPEG or PNG image.");
            var reader = readers.next();
            try {
                reader.setInput(input, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels < 1 || pixels > 12_192_768)
                    throw bad("Choose an image with no more than 12,192,768 pixels.");
                if (reader.read(0) == null) throw bad("The image could not be decoded.");
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException error) {
            throw bad("The image could not be decoded. Choose a readable JPEG or PNG image.");
        }
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException unsupported() {
        return new ResponseStatusException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Use a PDF, JPEG or PNG file with a matching extension and media type.");
    }

    public record Declared(String filename, String contentType) {}

    public record ValidatedDocument(String filename, String contentType, byte[] bytes) {}
}
