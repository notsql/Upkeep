package com.proj.server.reading;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.proj.server.device.DeviceMetric;
import java.io.IOException;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReadingCsvWriterTests {
    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ASSET = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID DEVICE = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final OffsetDateTime MEASURED =
            OffsetDateTime.of(2026, 1, 2, 11, 4, 5, 123_000_000, ZoneOffset.ofHours(8));
    private static final OffsetDateTime RECORDED = OffsetDateTime.of(2026, 1, 2, 3, 4, 6, 0, ZoneOffset.UTC);

    private static EstateReadingResponse reading(String reference, String name, String recordedByName) {
        return new EstateReadingResponse(
                ID,
                ASSET,
                reference,
                name,
                MEASURED,
                DeviceMetric.TEMPERATURE,
                "°C",
                new BigDecimal("21.5"),
                DEVICE,
                "dev-1",
                List.of(ReadingFlagResponse.gap(60), ReadingFlagResponse.duplicate()),
                ReadingSource.SENSOR,
                "user_1",
                recordedByName,
                RECORDED);
    }

    private static String write(EstateReadingResponse row) throws IOException {
        StringWriter out = new StringWriter();
        ReadingCsvWriter.row(out, row);
        return out.toString();
    }

    @Test
    void headerIsUnchanged() {
        assertEquals(
                "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,"
                        + "device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags\r\n",
                ReadingCsvWriter.HEADER);
    }

    @Test
    void writesEveryFieldQuotedWithCrlf() throws IOException {
        assertEquals(
                "\"00000000-0000-0000-0000-000000000001\",\"2026-01-02T03:04:05.123000Z\","
                        + "\"00000000-0000-0000-0000-000000000002\",\"P-1\",\"Pump\",\"TEMPERATURE\",\"21.500000\","
                        + "\"°C\",\"SENSOR\",\"00000000-0000-0000-0000-000000000003\",\"dev-1\",\"user_1\",\"Ann\","
                        + "\"2026-01-02T03:04:06.000000Z\",\"GAP;DUPLICATE_TIMESTAMP\"\r\n",
                write(reading("P-1", "Pump", "Ann")));
    }

    @Test
    void writesNullOptionalFieldsAsEmptyQuotedCells() throws IOException {
        EstateReadingResponse row = new EstateReadingResponse(
                ID,
                ASSET,
                "P-1",
                "Pump",
                MEASURED,
                DeviceMetric.TEMPERATURE,
                "°C",
                new BigDecimal("1"),
                null,
                null,
                List.of(),
                ReadingSource.MANUAL,
                null,
                null,
                RECORDED);
        assertEquals(
                "\"00000000-0000-0000-0000-000000000001\",\"2026-01-02T03:04:05.123000Z\","
                        + "\"00000000-0000-0000-0000-000000000002\",\"P-1\",\"Pump\",\"TEMPERATURE\",\"1.000000\","
                        + "\"°C\",\"MANUAL\",\"\",\"\",\"\",\"\",\"2026-01-02T03:04:06.000000Z\",\"\"\r\n",
                write(row));
    }

    @Test
    void escapesCommasQuotesAndNewlinesPerRfc4180() throws IOException {
        String csv = write(reading("A,1", "Pump \"North\"", "line1\r\nline2\nend"));
        assertEquals(
                "\"00000000-0000-0000-0000-000000000001\",\"2026-01-02T03:04:05.123000Z\","
                        + "\"00000000-0000-0000-0000-000000000002\",\"A,1\",\"Pump \"\"North\"\"\",\"TEMPERATURE\","
                        + "\"21.500000\",\"°C\",\"SENSOR\",\"00000000-0000-0000-0000-000000000003\",\"dev-1\","
                        + "\"user_1\",\"line1\r\nline2\nend\",\"2026-01-02T03:04:06.000000Z\","
                        + "\"GAP;DUPLICATE_TIMESTAMP\"\r\n",
                csv);
    }

    @Test
    void neutralisesFormulaPrefixesBeforeQuoting() throws IOException {
        String csv = write(reading("=SUM(A1)", "'Pump", " @x"));
        assertEquals(
                "\"00000000-0000-0000-0000-000000000001\",\"2026-01-02T03:04:05.123000Z\","
                        + "\"00000000-0000-0000-0000-000000000002\",\"'=SUM(A1)\",\"''Pump\",\"TEMPERATURE\","
                        + "\"21.500000\",\"°C\",\"SENSOR\",\"00000000-0000-0000-0000-000000000003\",\"dev-1\","
                        + "\"user_1\",\"' @x\",\"2026-01-02T03:04:06.000000Z\",\"GAP;DUPLICATE_TIMESTAMP\"\r\n",
                csv);
    }
}
