package com.proj.server.reading;

import com.proj.server.db.tables.records.DevicereadingRecord;
import com.proj.server.device.DeviceMetric;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
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
    private final ApplicationEventPublisher events;

    public ReadingService(ReadingRepository repository, ApplicationEventPublisher events) {
        this.repository = repository;
        this.events = events;
    }

    /** The reading, and whether this submission stored it (201) or it was already stored (200). */
    public record Submitted(ReadingResponse reading, boolean created) {}

    @Transactional
    public Submitted submit(UUID deviceId, byte[] body) {
        var receivedAt = now();
        var device = device(deviceId);
        var reading = ReadingValidator.parse(body, device.metrics(), receivedAt);
        requireActive(device);
        var submitted = store(device, reading, receivedAt);
        repository.markSeen(deviceId, receivedAt);
        if (submitted.created()) {
            // Scoring starts after commit (decision 0044).
            events.publishEvent(new ReadingsStored(device.assetId()));
        }
        return submitted;
    }

    /**
     * A batch: the body's shape and the estate are checked for the whole batch,
     * then each item is decided as {@link #submit} would decide it, in order, so
     * a later identical item finds the earlier one stored.
     */
    @Transactional
    public TelemetryBatchResponse submitBatch(UUID deviceId, byte[] body) {
        var receivedAt = now();
        var device = device(deviceId);
        var items = ReadingValidator.batch(body);
        requireActive(device);

        var results = new ArrayList<TelemetryItemResult>(items.size());
        var seen = false;
        var created = false;
        for (var index = 0; index < items.size(); index++) {
            try {
                var reading = ReadingValidator.item(items.get(index), device.metrics(), receivedAt);
                var submitted = store(device, reading, receivedAt);
                results.add(TelemetryItemResult.stored(index, submitted));
                seen = true;
                created |= submitted.created();
            } catch (ReadingException rejected) {
                results.add(TelemetryItemResult.rejected(index, rejected));
            }
        }
        if (seen) {
            repository.markSeen(deviceId, receivedAt);
        }
        if (created) {
            events.publishEvent(new ReadingsStored(device.assetId()));
        }
        return new TelemetryBatchResponse(results);
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
    }

    private ReadingRepository.SubmittingDevice device(UUID deviceId) {
        // The key's device was found moments ago; gone now only if it raced a change.
        return repository
                .findDevice(deviceId)
                .orElseThrow(() -> new ReadingException(HttpStatus.UNAUTHORIZED, "A valid device key is required."));
    }

    private static void requireActive(ReadingRepository.SubmittingDevice device) {
        // A retired asset's devices still report, so one left switched on can be found (ID-44).
        if (device.estateInactive()) {
            throw new ReadingException(HttpStatus.CONFLICT, "This estate is inactive. Readings are not accepted.");
        }
    }

    /** Stores one valid reading, or finds the identical one stored; a different stored value is a 409. */
    private Submitted store(
            ReadingRepository.SubmittingDevice device, CreateReadingRequest reading, OffsetDateTime receivedAt) {
        var inserted = repository.insert(device, reading, receivedAt);
        if (inserted.isPresent()) {
            return new Submitted(response(inserted.get()), true);
        }
        var stored = repository.find(device.id(), reading.metric(), reading.measuredAt());
        if (stored.getValue().compareTo(reading.value()) != 0) {
            throw new ReadingException(
                    HttpStatus.CONFLICT,
                    "A different value is already stored for %s at %s. A correction needs a new measuredAt."
                            .formatted(
                                    reading.metric(),
                                    DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(reading.measuredAt())));
        }
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
