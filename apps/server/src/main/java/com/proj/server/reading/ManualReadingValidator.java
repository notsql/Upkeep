package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import java.time.OffsetDateTime;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import tools.jackson.core.JacksonException;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class ManualReadingValidator {
    private static final Set<String> FIELDS =
            Set.of("assetId", "submissionId", "metric", "value", "unit", "measuredAt");
    private static final JsonMapper JSON = JsonMapper.builder()
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .build();

    private ManualReadingValidator() {}

    static CreateManualReadingRequest parse(byte[] body, OffsetDateTime now) {
        JsonNode node;
        try {
            node = JSON.readTree(body);
        } catch (JacksonException error) {
            throw invalid("The request body must be a JSON object, with each field given once.");
        }
        if (node == null || !node.isObject()) throw invalid("The request body must be a JSON object.");
        for (var field : FIELDS)
            if (node.get(field) == null || node.get(field).isNull()) throw invalid(field + " is required.");
        for (var field : node.propertyNames()) if (!FIELDS.contains(field)) throw invalid(field + " is not accepted.");
        var payload = JSON.createObjectNode();
        for (var field : new String[] {"metric", "value", "unit", "measuredAt"}) payload.set(field, node.get(field));
        var reading = ReadingValidator.parse(JSON.writeValueAsBytes(payload), EnumSet.allOf(DeviceMetric.class), now);
        return new CreateManualReadingRequest(
                uuid(node, "assetId"),
                reading.metric(),
                reading.value(),
                reading.unit(),
                reading.measuredAt(),
                uuid(node, "submissionId"));
    }

    private static UUID uuid(JsonNode node, String field) {
        if (!node.get(field).isString()) throw invalid(field + " must be a UUID.");
        var text = node.get(field).stringValue();
        try {
            var value = UUID.fromString(text);
            if (value.toString().equalsIgnoreCase(text)) return value;
        } catch (IllegalArgumentException error) {
            /* Return the same validation error for malformed UUIDs. */
        }
        throw invalid(field + " must be a UUID.");
    }

    private static ReadingException invalid(String message) {
        return new ReadingException(HttpStatus.BAD_REQUEST, message);
    }
}
