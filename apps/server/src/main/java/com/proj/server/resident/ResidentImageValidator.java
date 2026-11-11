package com.proj.server.resident;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ResidentImageValidator {
    public static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final int MAX_WIDTH = 4032;
    private static final int MAX_HEIGHT = 3024;
    private static final long MAX_PIXELS = (long) MAX_WIDTH * MAX_HEIGHT;

    /** The stored type for a declared image type; 415 for anything but JPEG or PNG. */
    public String acceptedType(String declared) {
        return switch (declared == null ? "" : declared.toLowerCase()) {
            case "image/jpeg", "image/jpg" -> "image/jpeg";
            case "image/png" -> "image/png";
            default -> throw new ResidentReportException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Use a JPEG or PNG image.");
        };
    }

    public void checkSize(long size) {
        if (size < 1) {
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "The selected image is empty.");
        }
        if (size > MAX_BYTES) {
            throw new ResidentReportException(HttpStatus.PAYLOAD_TOO_LARGE, "Each image must be at most 5 MB.");
        }
    }

    /** Decodes the image, checks its pixels and re-encodes it without metadata. */
    public ValidatedImage validate(String declared, byte[] bytes) {
        String type = acceptedType(declared);
        checkSize(bytes.length);
        try (var input = ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(bytes))) {
            if (input == null) {
                throw invalid();
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalid();
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String actual = reader.getFormatName().toLowerCase();
                if (!(type.equals("image/png") && actual.equals("png"))
                        && !(type.equals("image/jpeg") && (actual.equals("jpeg") || actual.equals("jpg")))) {
                    throw invalid();
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1
                        || height < 1
                        || width > MAX_WIDTH
                        || height > MAX_HEIGHT
                        || (long) width * height > MAX_PIXELS) {
                    throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Image dimensions are too large.");
                }
                BufferedImage decoded = reader.read(0);
                if (decoded == null) {
                    throw invalid();
                }
                var clean = new BufferedImage(
                        width,
                        height,
                        type.equals("image/jpeg") ? BufferedImage.TYPE_INT_RGB : BufferedImage.TYPE_INT_ARGB);
                var graphics = clean.createGraphics();
                try {
                    graphics.drawImage(decoded, 0, 0, null);
                } finally {
                    graphics.dispose();
                }
                var output = new ByteArrayOutputStream();
                if (!ImageIO.write(clean, type.equals("image/jpeg") ? "jpeg" : "png", output)) {
                    throw invalid();
                }
                var cleaned = output.toByteArray();
                if (cleaned.length > MAX_BYTES) {
                    throw new ResidentReportException(HttpStatus.PAYLOAD_TOO_LARGE, "Each image must be at most 5 MB.");
                }
                return new ValidatedImage(type, cleaned);
            } finally {
                reader.dispose();
            }
        } catch (IOException | IndexOutOfBoundsException error) {
            throw invalid();
        }
    }

    private static ResidentReportException invalid() {
        return new ResidentReportException(HttpStatus.BAD_REQUEST, "The selected image could not be read.");
    }

    public record ValidatedImage(String contentType, byte[] bytes) {}
}
