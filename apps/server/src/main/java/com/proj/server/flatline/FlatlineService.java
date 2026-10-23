package com.proj.server.flatline;

import com.proj.server.device.DeviceMetric;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FlatlineService {
    private final FlatlineRepository repository;
    private final Clock clock;
    private final FlatlineDetector detector = new FlatlineDetector();

    public FlatlineService(FlatlineRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public FlatlinePoliciesResponse policies(UUID estateId, String user, boolean admin) {
        var access = access(estateId, user, admin, false, false);
        var configured = repository.policies(estateId);
        return new FlatlinePoliciesResponse(
                canManage(access, admin),
                access.active(),
                Arrays.stream(DeviceMetric.values())
                        .map(metric -> configured.getOrDefault(metric, unconfigured(metric)))
                        .toList());
    }

    @Transactional
    public FlatlinePolicyResponse setPolicy(
            UUID estateId, DeviceMetric metric, SetFlatlinePolicyRequest request, String user, boolean admin) {
        access(estateId, user, admin, true, true);
        repository.savePolicy(estateId, metric, request, clock.instant());
        return new FlatlinePolicyResponse(metric, metric.unit(), request.durationMinutes(), request.tolerance());
    }

    @Transactional
    public FlatlinePauseResponse pause(
            UUID estateId,
            UUID deviceId,
            DeviceMetric metric,
            CreateFlatlinePauseRequest request,
            String user,
            boolean admin) {
        access(estateId, user, admin, true, true);
        var device = repository
                .device(estateId, deviceId, true)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Device not found."));
        if (device.retired()) {
            throw error(HttpStatus.CONFLICT, "This asset is retired.");
        }
        if (!device.metrics().contains(metric)) {
            throw error(HttpStatus.CONFLICT, "This metric is not registered on this device.");
        }
        if (!repository.policies(estateId).containsKey(metric)) {
            throw error(HttpStatus.CONFLICT, "Configure this metric before pausing detection.");
        }
        var now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        var pause = new FlatlinePauseResponse(
                deviceId, metric, now, now.plus(Duration.ofMinutes(request.durationMinutes())), user);
        if (!repository.savePause(estateId, device, pause)) {
            throw error(HttpStatus.CONFLICT, "This device metric already has an active maintenance pause.");
        }
        return pause;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public FlatlineReviewResponse review(
            UUID estateId, String user, boolean admin, FlatlineView view, int page, int size) {
        var access = access(estateId, user, admin, false, false);
        long offset = (long) page * size;
        if (page < 0 || size < 1 || size > 100 || offset > Integer.MAX_VALUE) {
            throw error(HttpStatus.BAD_REQUEST, "Page must be non-negative and size must be between 1 and 100.");
        }
        var checkedAt = clock.instant();
        if (!access.active()) {
            return new FlatlineReviewResponse(
                    checkedAt, canManage(access, admin), false, false, page, size, 0, List.of());
        }
        var policies = repository.policies(estateId);
        var pauses = repository.pauses(estateId);
        var recorded = repository.recordedSeries(estateId);
        var readings = repository.readings(estateId, checkedAt);
        var locationPaths = repository.locationPaths(estateId);
        var sensors = new ArrayList<SensorMonitoringResponse>();
        for (var device : repository.devices(estateId)) {
            for (var metric : device.metrics()) {
                var series = new FlatlineRepository.Series(device.id(), metric);
                var sensor = monitor(
                        device,
                        metric,
                        policies.getOrDefault(metric, unconfigured(metric)),
                        pauses.get(series),
                        recorded.contains(series),
                        readings.getOrDefault(series, List.of()),
                        checkedAt,
                        locationPaths);
                if (view == FlatlineView.ALL
                        || sensor.state() == SensorMonitoringResponse.State.FLATLINED
                        || sensor.state() == SensorMonitoringResponse.State.PAUSED) {
                    sensors.add(sensor);
                }
            }
        }
        sensors.sort(Comparator.comparing(SensorMonitoringResponse::deviceIdentifier)
                .thenComparing(SensorMonitoringResponse::metric)
                .thenComparing(SensorMonitoringResponse::deviceId));
        var pageRows = sensors.stream().skip(offset).limit(size).toList();
        return new FlatlineReviewResponse(
                checkedAt, canManage(access, admin), true, !recorded.isEmpty(), page, size, sensors.size(), pageRows);
    }

    private SensorMonitoringResponse monitor(
            FlatlineRepository.SensorDevice device,
            DeviceMetric metric,
            FlatlinePolicyResponse policy,
            FlatlinePauseResponse pause,
            boolean hasReadings,
            List<FlatlineDetector.Reading> readings,
            Instant checkedAt,
            Map<UUID, String> locationPaths) {
        var latest = readings.isEmpty() ? null : readings.getLast();
        var cutoff = Optional.ofNullable(pause).map(FlatlinePauseResponse::resumesAt);
        boolean paused = pause != null && checkedAt.isBefore(pause.resumesAt());
        boolean hasEligible = readings.stream()
                .anyMatch(reading -> cutoff.isEmpty() || !reading.measuredAt().isBefore(cutoff.get()));
        FlatlineEvidenceResponse evidence = null;
        SensorMonitoringResponse.State state;
        if (paused) {
            state = SensorMonitoringResponse.State.PAUSED;
        } else if (policy.durationMinutes() == null) {
            state = SensorMonitoringResponse.State.NOT_CONFIGURED;
        } else if (!hasReadings) {
            state = SensorMonitoringResponse.State.NO_DATA;
        } else if (!hasEligible) {
            state = SensorMonitoringResponse.State.WAITING_FOR_READINGS;
        } else {
            var run = detector.detect(
                    readings,
                    new FlatlineDetector.Policy(
                            Duration.ofMinutes(policy.durationMinutes()),
                            policy.tolerance(),
                            Duration.ofSeconds(2L * device.reportingIntervalSeconds())),
                    checkedAt,
                    cutoff);
            state = run.isPresent()
                    ? SensorMonitoringResponse.State.FLATLINED
                    : SensorMonitoringResponse.State.MONITORING;
            if (run.isPresent()) {
                var r = run.get();
                evidence = new FlatlineEvidenceResponse(
                        r.unchangedSince(),
                        r.lastReadingAt(),
                        r.observedDuration().getSeconds(),
                        r.minimumValue(),
                        r.maximumValue(),
                        r.latestValue());
            }
        }
        return new SensorMonitoringResponse(
                device.id(),
                device.assetId(),
                device.identifier(),
                device.assetName(),
                device.assetReference(),
                locationPaths.get(device.assetLocationId()),
                locationPaths.get(device.deviceLocationId()),
                metric,
                metric.unit(),
                state,
                latest == null ? null : latest.measuredAt(),
                latest == null ? null : latest.value(),
                policy.durationMinutes(),
                policy.tolerance(),
                evidence,
                pause);
    }

    private FlatlineRepository.EstateScope access(
            UUID estateId, String user, boolean admin, boolean write, boolean lock) {
        var scope = repository
                .estate(estateId, user, lock)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Estate not found."));
        if ("RESIDENT".equals(scope.role())) {
            throw error(HttpStatus.FORBIDDEN, "Resident membership does not grant device monitoring access.");
        }
        if (!scope.owner() && scope.role() == null) {
            throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        }
        boolean canRead = canManage(scope, admin) || "COUNCIL".equals(scope.role());
        if (!canRead || (write && !canManage(scope, admin))) {
            throw error(HttpStatus.FORBIDDEN, "Your estate role does not permit this device monitoring operation.");
        }
        if (write && !scope.active()) {
            throw error(HttpStatus.CONFLICT, "This estate is inactive.");
        }
        return scope;
    }

    private static boolean canManage(FlatlineRepository.EstateScope scope, boolean admin) {
        return scope.owner()
                || "MANAGER".equals(scope.role())
                || (admin && ("MEMBER".equals(scope.role()) || "COUNCIL".equals(scope.role())));
    }

    private static FlatlinePolicyResponse unconfigured(DeviceMetric metric) {
        return new FlatlinePolicyResponse(metric, metric.unit(), null, BigDecimal.ZERO);
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
