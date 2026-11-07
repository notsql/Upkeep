package com.proj.server.reading;

import java.io.IOException;
import java.io.Writer;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.QuoteMode;

final class ReadingCsvWriter {
    static final String HEADER =
            "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags\r\n";
    private static final DateTimeFormatter TIME =
            DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSSSS'Z'").withZone(ZoneOffset.UTC);
    // RFC 4180 (CRLF records, doubled quotes) with every field quoted, matching schema v1.
    private static final CSVFormat FORMAT =
            CSVFormat.RFC4180.builder().setQuoteMode(QuoteMode.ALL).get();

    private ReadingCsvWriter() {}

    static void row(Writer writer, EstateReadingResponse row) throws IOException {
        String[] cells = {
            row.id().toString(),
            TIME.format(row.measuredAt()),
            row.assetId().toString(),
            safeText(row.assetReference()),
            safeText(row.assetName()),
            row.metric().name(),
            row.value().setScale(6).toPlainString(),
            row.unit(),
            row.source().name(),
            Objects.toString(row.deviceId(), ""),
            safeText(row.deviceIdentifier()),
            safeText(row.recordedByUserId()),
            safeText(row.recordedByName()),
            TIME.format(row.recordedAt()),
            row.flags().stream().map(flag -> flag.type().name()).collect(Collectors.joining(";"))
        };
        // Not closed: closing the printer would close the response stream mid-export.
        new CSVPrinter(writer, FORMAT).printRecord((Object[]) cells);
    }

    private static String safeText(String value) {
        if (value == null || value.isEmpty()) return "";
        char first = value.charAt(0);
        if (first == '\'' || first < 0x20) return "'" + value;
        int index = 0;
        while (index < value.length() && (Character.isWhitespace(value.charAt(index)) || value.charAt(index) <= 0x20))
            index++;
        return index < value.length() && "=+-@".indexOf(value.charAt(index)) >= 0 ? "'" + value : value;
    }
}
