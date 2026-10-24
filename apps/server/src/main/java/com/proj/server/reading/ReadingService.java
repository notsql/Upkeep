package com.proj.server.reading;

import com.proj.server.db.tables.records.DevicereadingRecord;
import com.proj.server.device.DeviceMetric;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stores a device's reading (ID-43). The device, its asset and its estate come
 * only from the key (decision 0025). Duplicates, conflicts and late readings
 * follow decision 0028.
 */
@Service
public class ReadingService {
    private final ReadingRepository repository;

    public ReadingService(ReadingRepository repository) {
        this.repository = repository;
    }

    /** The reading, and whether this submission stored it (201) or it was already stored (200). */
    public record Submitted(ReadingResponse reading, boolean created) {}

    @Transactional
    public Submitted submit(UUID deviceId, byte[] body) {
        var receivedAt = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        // The key's device was found moments ago; gone now only if it raced a change.
        var device = repository
                .findDevice(deviceId)
                .orElseThrow(() -> new ReadingException(HttpStatus.UNAUTHORIZED, "A valid device key is required."));
        var reading = ReadingValidator.parse(body, device.metrics(), receivedAt);
        // A retired asset's devices still report, so one left switched on can be found (ID-44).
        if (device.estateInactive()) {
            throw new ReadingException(HttpStatus.CONFLICT, "This estate is inactive. Readings are not accepted.");
        }

        var inserted = repository.insert(device, reading, receivedAt);
        if (inserted.isPresent()) {
            repository.markSeen(deviceId, receivedAt);
            return new Submitted(response(inserted.get()), true);
        }
        var stored = repository.find(deviceId, reading.metric(), reading.measuredAt());
        if (stored.getValue().compareTo(reading.value()) != 0) {
            throw new ReadingException(
                    HttpStatus.CONFLICT,
                    "A different value is already stored for %s at %s. A correction needs a new measuredAt."
                            .formatted(
                                    reading.metric(),
                                    DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(reading.measuredAt())));
        }
        repository.markSeen(deviceId, receivedAt);
        return new Submitted(response(stored), false);
    }

    private static ReadingResponse response(DevicereadingRecord row) {
        var metric = DeviceMetric.valueOf(row.getMetric());
        return new ReadingResponse(
                row.getId(),
                row.getDeviceid(),
                row.getAssetid(),
                metric,
                row.getValue(),
                metric.unit(),
                // The driver returns the session's zone; the contract promises UTC.
                row.getMeasuredat().withOffsetSameInstant(ZoneOffset.UTC),
                row.getReceivedat().withOffsetSameInstant(ZoneOffset.UTC));
    }
}
