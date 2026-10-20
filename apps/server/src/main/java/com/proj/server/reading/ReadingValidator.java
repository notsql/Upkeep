package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import tools.jackson.core.JacksonException;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads a device's reading strictly, running the checks of ID-43 in the spec's
 * order and rejecting with the first failure. It checks the payload, never
 * whether a value is plausible (decision 0028).
 */
final class ReadingValidator {
    private static final List<String> FIELDS = List.of("metric", "value", "unit", "measuredAt");
    private static final int SCALE = 6;
    private static final int MAX_INTEGER_DIGITS = 12;
    private static final long MAX_FUTURE_MINUTES = 5;

    // Floats as BigDecimal, so a value is never routed through a double.
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .build();

    private ReadingValidator() {}

    /** {@code registered} is the device's metrics; {@code receivedAt} is the server's time. */
    static CreateReadingRequest parse(byte[] body, Set<DeviceMetric> registered, OffsetDateTime receivedAt) {
        var node = object(body);

        for (var field : FIELDS) {
            var value = node.get(field);
            if (value == null || value.isNull()) {
                throw invalid(field + " is required.");
            }
        }
        for (var field : node.propertyNames()) {
            if (!FIELDS.contains(field)) {
                throw invalid(field + " is not accepted. A reading has only metric, value, unit and measuredAt.");
            }
        }
        if (!node.get("metric").isString()) {
            throw invalid("metric must be a string.");
        }
        if (!node.get("value").isNumber()) {
            throw invalid("value must be a JSON number, such as 21.5. Strings and booleans are not converted.");
        }
        for (var field : List.of("unit", "measuredAt")) {
            if (!node.get(field).isString()) {
                throw invalid(field + " must be a string.");
            }
        }

        var value = value(node.get("value").decimalValue());
        var metric = metric(node.get("metric").stringValue(), registered);
        var unit = node.get("unit").stringValue();
        if (!unit.equals(metric.unit())) {
            throw invalid("unit for %s must be %s; got %s.".formatted(metric, metric.unit(), unit));
        }
        var measuredAt = measuredAt(node.get("measuredAt").stringValue(), receivedAt);
        return new CreateReadingRequest(metric, value, unit, measuredAt);
    }

    private static JsonNode object(byte[] body) {
        try {
            if (body != null && body.length > 0) {
                var node = JSON.readTree(body);
                if (node != null && node.isObject()) {
                    return node;
                }
            }
        } catch (JacksonException e) {
            // Falls through to the one message for every malformed body.
        }
        throw invalid("The request body must be a JSON object, with each field given once.");
    }

    /**
     * Rounds half-up to 6 places. The digit count is checked before rounding as
     * well as after, so neither {@code 1e999999999} nor {@code 1e-999999999} is
     * ever expanded.
     */
    private static BigDecimal value(BigDecimal raw) {
        if (integerDigits(raw) > MAX_INTEGER_DIGITS) {
            throw tooLarge();
        }
        if (integerDigits(raw) < -SCALE) {
            // Below 0.0000001 in magnitude, so under half the last place: rounds to zero.
            return BigDecimal.ZERO.setScale(SCALE);
        }
        var rounded = raw.setScale(SCALE, RoundingMode.HALF_UP);
        if (integerDigits(rounded) > MAX_INTEGER_DIGITS) {
            throw tooLarge();
        }
        return rounded;
    }

    private static ReadingException tooLarge() {
        return invalid("value must have at most " + MAX_INTEGER_DIGITS + " digits before the decimal point.");
    }

    /** Digits before the decimal point, by magnitude: |x| < 10^n. Zero or negative below 1. */
    private static long integerDigits(BigDecimal value) {
        return (long) value.precision() - value.scale();
    }

    private static DeviceMetric metric(String name, Set<DeviceMetric> registered) {
        var metric = Arrays.stream(DeviceMetric.values())
                .filter(candidate -> candidate.name().equals(name))
                .findFirst()
                .orElseThrow(() -> invalid("metric %s is not supported. Supported metrics: %s."
                        .formatted(name, names(Arrays.asList(DeviceMetric.values())))));
        if (!registered.contains(metric)) {
            var names = names(Arrays.stream(DeviceMetric.values())
                    .filter(registered::contains)
                    .toList());
            throw invalid(
                    "metric %s is not registered for this device. Registered metrics: %s.".formatted(metric, names));
        }
        return metric;
    }

    private static String names(List<DeviceMetric> metrics) {
        return metrics.stream().map(Enum::name).collect(Collectors.joining(", "));
    }

    /** In UTC and truncated to microseconds, as Postgres stores it, so the duplicate key is exact. */
    private static OffsetDateTime measuredAt(String text, OffsetDateTime receivedAt) {
        OffsetDateTime measuredAt;
        try {
            measuredAt = OffsetDateTime.parse(text, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        } catch (DateTimeParseException e) {
            throw invalid("measuredAt must be an ISO-8601 timestamp with a UTC offset, such as"
                    + " 2026-10-17T14:30:00+08:00.");
        }
        measuredAt = measuredAt.withOffsetSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        if (measuredAt.isAfter(receivedAt.plusMinutes(MAX_FUTURE_MINUTES))) {
            throw invalid("measuredAt is more than " + MAX_FUTURE_MINUTES
                    + " minutes after the server's time. Check the device's clock.");
        }
        return measuredAt;
    }

    private static ReadingException invalid(String message) {
        return new ReadingException(HttpStatus.BAD_REQUEST, message);
    }
}
