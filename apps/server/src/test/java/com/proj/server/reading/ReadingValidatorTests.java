package com.proj.server.reading;

import static com.proj.server.device.DeviceMetric.TEMPERATURE;
import static com.proj.server.device.DeviceMetric.VIBRATION;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import com.proj.server.device.DeviceMetric;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** The payload checks of ID-43, in the spec's order; the first failure wins. */
class ReadingValidatorTests {
    static final OffsetDateTime RECEIVED = OffsetDateTime.parse("2026-10-17T06:30:00Z");
    static final Set<DeviceMetric> REGISTERED = EnumSet.of(TEMPERATURE, VIBRATION);

    static String reading(String metric, String value, String unit, String measuredAt) {
        return "{\"metric\":%s,\"value\":%s,\"unit\":%s,\"measuredAt\":%s}".formatted(metric, value, unit, measuredAt);
    }

    static String valid(String value) {
        return reading("\"TEMPERATURE\"", value, "\"°C\"", "\"2026-10-17T14:30:00+08:00\"");
    }

    static CreateReadingRequest parse(String json) {
        return ReadingValidator.parse(json.getBytes(StandardCharsets.UTF_8), REGISTERED, RECEIVED);
    }

    static String rejection(String json) {
        var error = assertThrows(ReadingException.class, () -> parse(json));
        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        return error.getMessage();
    }

    @Test
    void acceptsAValidReading() {
        var reading = parse(valid("21.5"));
        assertEquals(TEMPERATURE, reading.metric());
        assertEquals(new BigDecimal("21.500000"), reading.value());
        assertEquals("°C", reading.unit());
        assertEquals(OffsetDateTime.parse("2026-10-17T06:30:00Z"), reading.measuredAt());
    }

    // 1. Not a JSON object

    @Test
    void rejectsABodyThatIsNotAJsonObject() {
        for (var body : new String[] {"", "not json", "[]", "42", "\"reading\"", "null", valid("21.5") + "{}"}) {
            assertEquals("The request body must be a JSON object, with each field given once.", rejection(body));
        }
        var error = assertThrows(ReadingException.class, () -> ReadingValidator.parse(null, REGISTERED, RECEIVED));
        assertEquals(HttpStatus.BAD_REQUEST, error.status());
    }

    @Test
    void rejectsAFieldGivenTwice() {
        var body = "{\"metric\":\"TEMPERATURE\",\"value\":21.5,\"value\":99,\"unit\":\"°C\","
                + "\"measuredAt\":\"2026-10-17T06:30:00Z\"}";
        assertEquals("The request body must be a JSON object, with each field given once.", rejection(body));
    }

    // 2. Missing or null

    @Test
    void namesTheFirstMissingFieldInOrder() {
        assertEquals("metric is required.", rejection("{}"));
        assertEquals("value is required.", rejection("{\"metric\":\"TEMPERATURE\"}"));
        assertEquals("unit is required.", rejection("{\"metric\":\"TEMPERATURE\",\"value\":1}"));
        assertEquals("measuredAt is required.", rejection("{\"metric\":\"TEMPERATURE\",\"value\":1,\"unit\":\"°C\"}"));
    }

    @Test
    void treatsNullAsMissing() {
        assertEquals("value is required.", rejection(valid("null")));
    }

    // 3. Unknown fields

    @Test
    void rejectsAFieldTheApiDoesNotDefine() {
        var body = valid("21.5").replace("}", ",\"deviceId\":\"someone-else\"}");
        assertEquals(
                "deviceId is not accepted. A reading has only metric, value, unit and measuredAt.", rejection(body));
    }

    @Test
    void reportsMissingFieldsBeforeUnknownOnes() {
        assertEquals("metric is required.", rejection("{\"deviceId\":\"x\"}"));
    }

    @Test
    void reportsUnknownFieldsBeforeTypeErrors() {
        var body = valid("\"21.5\"").replace("}", ",\"assetId\":1}");
        assertThat(rejection(body)).startsWith("assetId is not accepted.");
    }

    // 4. Wrong JSON types

    @Test
    void rejectsAValueThatIsNotAJsonNumber() {
        var message = "value must be a JSON number, such as 21.5. Strings and booleans are not converted.";
        assertEquals(message, rejection(valid("\"21.5\"")));
        assertEquals(message, rejection(valid("true")));
        assertEquals(message, rejection(valid("[21.5]")));
        assertEquals(message, rejection(valid("{\"v\":21.5}")));
    }

    @Test
    void rejectsTextFieldsThatAreNotStrings() {
        assertEquals("metric must be a string.", rejection(reading("1", "21.5", "\"°C\"", "\"2026-10-17T06:30:00Z\"")));
        assertEquals(
                "unit must be a string.",
                rejection(reading("\"TEMPERATURE\"", "21.5", "true", "\"2026-10-17T06:30:00Z\"")));
        assertEquals(
                "measuredAt must be a string.", rejection(reading("\"TEMPERATURE\"", "21.5", "\"°C\"", "1760682600")));
    }

    // 5. Magnitude

    @Test
    void acceptsUpToTwelveDigitsBeforeTheDecimalPoint() {
        assertEquals(
                new BigDecimal("999999999999.999999"),
                parse(valid("999999999999.999999")).value());
        assertEquals(
                new BigDecimal("-999999999999.000000"),
                parse(valid("-999999999999")).value());
    }

    @Test
    void rejectsMoreThanTwelveDigitsBeforeTheDecimalPoint() {
        var message = "value must have at most 12 digits before the decimal point.";
        assertEquals(message, rejection(valid("1234567890123")));
        assertEquals(message, rejection(valid("1e13")));
        assertEquals(message, rejection(valid("-1234567890123.5")));
    }

    @Test
    void rejectsAValueThatRoundsUpPastTwelveDigits() {
        assertEquals(
                "value must have at most 12 digits before the decimal point.",
                rejection(valid("999999999999.9999995")));
    }

    @Test
    void handlesHugeExponentsWithoutExpandingThem() {
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> {
            assertEquals(
                    "value must have at most 12 digits before the decimal point.", rejection(valid("1e999999999")));
            assertEquals(
                    new BigDecimal("0.000000"), parse(valid("1e-999999999")).value());
        });
    }

    // Rounding (decision 0028)

    @Test
    void roundsHalfUpToSixDecimalPlaces() {
        assertEquals(
                new BigDecimal("0.300000"), parse(valid("0.30000000000000004")).value());
        assertEquals(new BigDecimal("21.123457"), parse(valid("21.1234565")).value());
        assertEquals(new BigDecimal("-21.123457"), parse(valid("-21.1234565")).value());
    }

    @Test
    void roundsValuesBelowAMillionthHalfUp() {
        assertEquals(new BigDecimal("0.000001"), parse(valid("0.0000009")).value());
        assertEquals(new BigDecimal("0.000001"), parse(valid("0.0000005")).value());
        assertEquals(new BigDecimal("0.000000"), parse(valid("0.00000049")).value());
        assertEquals(new BigDecimal("0.000000"), parse(valid("0")).value());
    }

    @Test
    void givesEqualValuesTheSameRepresentation() {
        assertEquals(parse(valid("21.5")).value(), parse(valid("21.50")).value());
        assertEquals(new BigDecimal("21.000000"), parse(valid("21")).value());
        assertEquals(new BigDecimal("2150.000000"), parse(valid("2.15e3")).value());
    }

    @Test
    void doesNotJudgeWhetherAValueIsPlausible() {
        assertEquals(new BigDecimal("150.000000"), parse(valid("150")).value());
        assertEquals(new BigDecimal("-273.000000"), parse(valid("-273")).value());
    }

    // 6. Catalogue

    @Test
    void rejectsAMetricOutsideTheCatalogue() {
        var message = rejection(reading("\"FOO\"", "1", "\"°C\"", "\"2026-10-17T06:30:00Z\""));
        assertThat(message)
                .startsWith("metric FOO is not supported. Supported metrics: TEMPERATURE, HUMIDITY,")
                .contains("ENERGY");
    }

    @Test
    void matchesMetricNamesExactly() {
        assertThat(rejection(reading("\"temperature\"", "1", "\"°C\"", "\"2026-10-17T06:30:00Z\"")))
                .startsWith("metric temperature is not supported.");
    }

    // 7. Registered for this device

    @Test
    void rejectsAMetricThisDeviceIsNotRegisteredFor() {
        assertEquals(
                "metric PRESSURE is not registered for this device. Registered metrics: TEMPERATURE, VIBRATION.",
                rejection(reading("\"PRESSURE\"", "1", "\"bar\"", "\"2026-10-17T06:30:00Z\"")));
    }

    // 8. Unit

    @Test
    void rejectsAUnitThatIsNotExactlyTheCatalogueUnit() {
        for (var unit : new String[] {"C", "degC", "°c", " °C", ""}) {
            assertEquals(
                    "unit for TEMPERATURE must be °C; got " + unit + ".",
                    rejection(reading("\"TEMPERATURE\"", "1", "\"" + unit + "\"", "\"2026-10-17T06:30:00Z\"")));
        }
    }

    @Test
    void acceptsTheCatalogueUnitOfEachRegisteredMetric() {
        var reading = parse(reading("\"VIBRATION\"", "2.8", "\"mm/s\"", "\"2026-10-17T06:30:00Z\""));
        assertEquals(VIBRATION, reading.metric());
        assertEquals("mm/s", reading.unit());
    }

    // 9. Timestamp format

    @Test
    void rejectsATimestampWithoutAUtcOffset() {
        var message = "measuredAt must be an ISO-8601 timestamp with a UTC offset, such as 2026-10-17T14:30:00+08:00.";
        for (var at : new String[] {"2026-10-17T14:30:00", "2026-10-17", "yesterday", "", "2026-10-17 14:30:00Z"}) {
            assertEquals(message, rejection(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"" + at + "\"")));
        }
    }

    @Test
    void treatsTheSameInstantInDifferentOffsetsAsTheSameTimestamp() {
        var local = parse(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"2026-10-17T14:30:00+08:00\""));
        var utc = parse(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"2026-10-17T06:30:00Z\""));
        assertEquals(utc.measuredAt(), local.measuredAt());
        assertEquals(ZoneOffset.UTC, local.measuredAt().getOffset());
    }

    @Test
    void truncatesTimestampsToMicrosecondsAsPostgresStoresThem() {
        var reading = parse(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"2026-10-17T06:29:00.1234567Z\""));
        assertEquals(OffsetDateTime.parse("2026-10-17T06:29:00.123456Z"), reading.measuredAt());
    }

    // 10. Future timestamps

    @Test
    void acceptsUpToFiveMinutesAfterTheServersTime() {
        var reading = parse(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"2026-10-17T06:35:00Z\""));
        assertEquals(OffsetDateTime.parse("2026-10-17T06:35:00Z"), reading.measuredAt());
    }

    @Test
    void rejectsMoreThanFiveMinutesAfterTheServersTime() {
        assertEquals(
                "measuredAt is more than 5 minutes after the server's time. Check the device's clock.",
                rejection(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"2026-10-17T06:35:00.000001Z\"")));
    }

    @Test
    void acceptsOldReadings() {
        var reading = parse(reading("\"TEMPERATURE\"", "1", "\"°C\"", "\"2020-01-01T00:00:00Z\""));
        assertEquals(OffsetDateTime.parse("2020-01-01T00:00:00Z"), reading.measuredAt());
    }

    // Order of checks

    @Test
    void reportsTheFirstFailureInTheSpecsOrder() {
        // 5 before 6: too many digits and an unknown metric
        assertThat(rejection(reading("\"FOO\"", "1e13", "\"C\"", "\"x\""))).startsWith("value must have");
        // 6 before 8 and 9
        assertThat(rejection(reading("\"FOO\"", "1", "\"C\"", "\"x\""))).startsWith("metric FOO");
        // 7 before 8
        assertThat(rejection(reading("\"PRESSURE\"", "1", "\"C\"", "\"x\""))).startsWith("metric PRESSURE");
        // 8 before 9
        assertThat(rejection(reading("\"TEMPERATURE\"", "1", "\"C\"", "\"x\""))).startsWith("unit for");
        // 9 before 10 is implied: an unparseable timestamp has no time to compare
    }
}
