package com.proj.server.reading;

import java.io.StringReader;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.springframework.http.HttpStatus;

/** Bounded CSV structure parsing. Measurement validation remains a separate, estate-scoped step. */
final class ReadingImportParser {
    static final int MAX_BYTES = 25 * 1024 * 1024;
    static final int MAX_ROWS = 100_000;
    static final int MAX_FIELD = 4096;
    static final String VERSION = "csv-v1";
    private static final Set<String> FIELDS = Set.of(
            "asset_id",
            "asset_reference",
            "metric",
            "measured_at",
            "value",
            "unit",
            "source",
            "reading_id",
            "recorded_at",
            "device_id",
            "device_identifier",
            "recorded_by_user_id",
            "recorded_by_name",
            "asset_name");
    private static final Set<String> ESCAPED =
            Set.of("asset_reference", "asset_name", "device_identifier", "recorded_by_user_id", "recorded_by_name");

    record Row(int number, int line, Map<String, String> cells) {}

    record Parsed(List<Row> rows, Map<String, String> mapping) {}

    static Parsed parse(byte[] bytes, ReadingImportOptions options) {
        if (bytes.length > MAX_BYTES) throw error(413, "Choose a CSV no larger than 25 MiB.");
        if (options.submissionId() == null
                || options.sourceLabel() == null
                || options.sourceLabel().isBlank()
                || options.sourceLabel().length() > 200
                || options.preset() == null
                || options.mapping() == null)
            throw error(400, "A submission UUID, source label, preset and mapping are required.");
        if (!Set.of("asset_id", "asset_reference")
                .contains(options.assetLookupMode() == null ? "" : options.assetLookupMode()))
            throw error(400, "Select exactly one asset lookup mode.");
        String text;
        try {
            text = StandardCharsets.UTF_8
                    .newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException invalid) {
            throw error(415, "The CSV must use valid UTF-8 encoding.");
        }
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        var format = CSVFormat.RFC4180.builder().setIgnoreEmptyLines(false).get();
        try (var parser = format.parse(new StringReader(text))) {
            var iterator = parser.iterator();
            if (!iterator.hasNext()) throw error(400, "Choose a CSV containing a header and data records.");
            var headers = iterator.next().toList();
            if (headers.size() > 128 || headers.stream().anyMatch(value -> value.length() > MAX_FIELD))
                throw error(413, "CSV headers must be at most 4,096 characters and 128 columns.");
            if (headers.stream().anyMatch(String::isBlank) || new HashSet<>(headers).size() != headers.size())
                throw error(400, "Every CSV column needs a distinct, nonblank header.");
            var mapping = new LinkedHashMap<>(options.mapping());
            if (options.preset() == ReadingImportPreset.EXPORT) {
                for (var field : FIELDS) if (headers.contains(field)) mapping.putIfAbsent(field, field);
                // The selected lookup mode determines which export asset field is authoritative.
                mapping.remove(options.assetLookupMode().equals("asset_id") ? "asset_reference" : "asset_id");
            }
            var selected = new HashSet<String>();
            for (var entry : mapping.entrySet()) {
                if (!FIELDS.contains(entry.getKey())
                        || !headers.contains(entry.getValue())
                        || !selected.add(entry.getValue()))
                    throw error(400, "Map each field to a distinct existing CSV column.");
            }
            for (var required : List.of(options.assetLookupMode(), "metric", "measured_at", "value"))
                if (!mapping.containsKey(required)) throw error(400, "Map the required column: " + required + ".");
            if (mapping.containsKey("asset_id") && mapping.containsKey("asset_reference"))
                throw error(400, "Select exactly one asset lookup mode.");
            var indexes = new LinkedHashMap<String, Integer>();
            mapping.forEach((key, value) -> indexes.put(key, headers.indexOf(value)));
            var rows = new ArrayList<Row>();
            int cursor = 0, line = 1;
            while (iterator.hasNext()) {
                var record = iterator.next();
                while (cursor < record.getCharacterPosition()) {
                    char c = text.charAt(cursor++);
                    if (c == '\n' || c == '\r' && (cursor >= text.length() || text.charAt(cursor) != '\n')) line++;
                }
                if (record.size() > 128 || record.stream().anyMatch(value -> value.length() > MAX_FIELD))
                    throw error(413, "CSV fields must be at most 4,096 characters and records at most 128 columns.");
                if (record.stream().allMatch(String::isBlank)) continue;
                if (rows.size() == MAX_ROWS)
                    throw error(413, "A CSV can contain at most 100,000 nonblank data records.");
                var cells = new LinkedHashMap<String, String>();
                for (var entry : indexes.entrySet()) {
                    var value = entry.getValue() < record.size() ? record.get(entry.getValue()) : "";
                    if (options.preset() == ReadingImportPreset.EXPORT
                            && ESCAPED.contains(entry.getKey())
                            && value.startsWith("'")) value = value.substring(1);
                    cells.put(entry.getKey(), value);
                }
                rows.add(new Row(rows.size() + 2, line, Map.copyOf(cells)));
            }
            if (rows.isEmpty()) throw error(400, "The CSV contains no data records.");
            return new Parsed(List.copyOf(rows), Map.copyOf(mapping));
        } catch (java.io.IOException | java.io.UncheckedIOException | IllegalArgumentException malformed) {
            throw error(400, "Malformed CSV: check quoting, the header and comma delimiters.");
        }
    }

    static ReadingException error(int status, String message) {
        return new ReadingException(HttpStatus.valueOf(status), message);
    }
}
