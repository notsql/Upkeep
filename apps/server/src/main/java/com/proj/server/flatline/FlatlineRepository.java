package com.proj.server.flatline;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Deviceflatlinepause.DEVICEFLATLINEPAUSE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Flatlinepolicy.FLATLINEPOLICY;
import static com.proj.server.db.tables.Location.LOCATION;

import com.proj.server.device.DeviceMetric;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class FlatlineRepository {
    private final DSLContext db;

    public FlatlineRepository(DSLContext db) {
        this.db = db;
    }

    record EstateScope(boolean owner, String role, boolean active) {}

    record Series(UUID deviceId, DeviceMetric metric) {}

    record SensorDevice(
            UUID id,
            UUID assetId,
            String identifier,
            String assetName,
            String assetReference,
            UUID assetLocationId,
            UUID deviceLocationId,
            Set<DeviceMetric> metrics,
            int reportingIntervalSeconds,
            boolean retired) {}

    Optional<EstateScope> estate(UUID estateId, String user, boolean lock) {
        var query = db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId));
        var estate = lock ? query.forUpdate().fetchOptional() : query.fetchOptional();
        return estate.map(row -> new EstateScope(
                user.equals(row.getOwneruserid()),
                db.select(ESTATEUSER.ROLE)
                        .from(ESTATEUSER)
                        .where(ESTATEUSER.ESTATEID.eq(estateId), ESTATEUSER.USERID.eq(user))
                        .fetchOne(ESTATEUSER.ROLE),
                row.getDeactivatedat() == null));
    }

    Map<DeviceMetric, FlatlinePolicyResponse> policies(UUID estateId) {
        var result = new EnumMap<DeviceMetric, FlatlinePolicyResponse>(DeviceMetric.class);
        for (var row : db.selectFrom(FLATLINEPOLICY)
                .where(FLATLINEPOLICY.ESTATEID.eq(estateId))
                .fetch()) {
            var metric = DeviceMetric.valueOf(row.getMetric());
            result.put(
                    metric,
                    new FlatlinePolicyResponse(metric, metric.unit(), row.getDurationminutes(), row.getTolerance()));
        }
        return result;
    }

    void savePolicy(UUID estateId, DeviceMetric metric, SetFlatlinePolicyRequest request, Instant now) {
        var at = utc(now);
        db.insertInto(FLATLINEPOLICY)
                .set(FLATLINEPOLICY.ESTATEID, estateId)
                .set(FLATLINEPOLICY.METRIC, metric.name())
                .set(FLATLINEPOLICY.DURATIONMINUTES, request.durationMinutes())
                .set(FLATLINEPOLICY.TOLERANCE, request.tolerance())
                .set(FLATLINEPOLICY.CREATEDAT, at)
                .set(FLATLINEPOLICY.UPDATEDAT, at)
                .onConflict(FLATLINEPOLICY.ESTATEID, FLATLINEPOLICY.METRIC)
                .doUpdate()
                .set(FLATLINEPOLICY.DURATIONMINUTES, request.durationMinutes())
                .set(FLATLINEPOLICY.TOLERANCE, request.tolerance())
                .set(FLATLINEPOLICY.UPDATEDAT, at)
                .execute();
    }

    List<SensorDevice> devices(UUID estateId) {
        return db.select(DEVICE.fields())
                .select(ASSET.NAME, ASSET.REFERENCE, ASSET.DEACTIVATEDAT, ASSET.LOCATIONID)
                .from(DEVICE)
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICE.ASSETID), ASSET.ESTATEID.eq(DEVICE.ESTATEID))
                .where(DEVICE.ESTATEID.eq(estateId), ASSET.DEACTIVATEDAT.isNull(), DEVICE.DEACTIVATEDAT.isNull())
                .orderBy(DEVICE.IDENTIFIER, DEVICE.ID)
                .fetch(FlatlineRepository::device);
    }

    Optional<SensorDevice> device(UUID estateId, UUID deviceId, boolean lockAsset) {
        var query = db.select(DEVICE.fields())
                .select(ASSET.NAME, ASSET.REFERENCE, ASSET.DEACTIVATEDAT, ASSET.LOCATIONID)
                .from(DEVICE)
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICE.ASSETID), ASSET.ESTATEID.eq(DEVICE.ESTATEID))
                .where(DEVICE.ESTATEID.eq(estateId), DEVICE.ID.eq(deviceId));
        return lockAsset
                ? query.forUpdate().of(ASSET).fetchOptional(FlatlineRepository::device)
                : query.fetchOptional(FlatlineRepository::device);
    }

    private static SensorDevice device(Record row) {
        var metrics = EnumSet.noneOf(DeviceMetric.class);
        Arrays.stream(row.get(DEVICE.METRICS)).map(DeviceMetric::valueOf).forEach(metrics::add);
        return new SensorDevice(
                row.get(DEVICE.ID),
                row.get(DEVICE.ASSETID),
                row.get(DEVICE.IDENTIFIER),
                row.get(ASSET.NAME),
                row.get(ASSET.REFERENCE),
                row.get(ASSET.LOCATIONID),
                row.get(DEVICE.LOCATIONID),
                metrics,
                row.get(DEVICE.REPORTINGINTERVALSECONDS),
                row.get(ASSET.DEACTIVATEDAT) != null);
    }

    /** One estate-scoped read includes inactive ancestors for complete current paths. */
    Map<UUID, String> locationPaths(UUID estateId) {
        var locations = db.select(LOCATION.ID, LOCATION.PARENTID, LOCATION.NAME)
                .from(LOCATION)
                .where(LOCATION.ESTATEID.eq(estateId))
                .fetchMap(LOCATION.ID);
        var paths = new HashMap<UUID, String>();
        for (var id : locations.keySet()) {
            var names = new ArrayDeque<String>();
            UUID next = id;
            while (next != null) {
                var location = locations.get(next);
                names.addFirst(location.get(LOCATION.NAME));
                next = location.get(LOCATION.PARENTID);
            }
            paths.put(id, String.join(" › ", names));
        }
        return paths;
    }

    Map<Series, FlatlinePauseResponse> pauses(UUID estateId) {
        var result = new HashMap<Series, FlatlinePauseResponse>();
        var rows = db.select(DEVICEFLATLINEPAUSE.fields())
                .from(DEVICEFLATLINEPAUSE)
                .join(DEVICE)
                .on(
                        DEVICE.ID.eq(DEVICEFLATLINEPAUSE.DEVICEID),
                        DEVICE.ESTATEID.eq(DEVICEFLATLINEPAUSE.ESTATEID),
                        DEVICE.ASSETID.eq(DEVICEFLATLINEPAUSE.ASSETID))
                .where(DEVICEFLATLINEPAUSE.ESTATEID.eq(estateId))
                .fetch();
        for (var row : rows) {
            var metric = DeviceMetric.valueOf(row.get(DEVICEFLATLINEPAUSE.METRIC));
            var pause = new FlatlinePauseResponse(
                    row.get(DEVICEFLATLINEPAUSE.DEVICEID),
                    metric,
                    row.get(DEVICEFLATLINEPAUSE.PAUSEDAT).toInstant(),
                    row.get(DEVICEFLATLINEPAUSE.RESUMESAT).toInstant(),
                    row.get(DEVICEFLATLINEPAUSE.PAUSEDBYUSERID));
            result.put(new Series(pause.deviceId(), metric), pause);
        }
        return result;
    }

    /** Conditional upsert also protects concurrent first pauses at the unique key. */
    boolean savePause(UUID estateId, SensorDevice device, FlatlinePauseResponse pause) {
        return db.insertInto(DEVICEFLATLINEPAUSE)
                        .set(DEVICEFLATLINEPAUSE.DEVICEID, device.id())
                        .set(DEVICEFLATLINEPAUSE.METRIC, pause.metric().name())
                        .set(DEVICEFLATLINEPAUSE.ESTATEID, estateId)
                        .set(DEVICEFLATLINEPAUSE.ASSETID, device.assetId())
                        .set(DEVICEFLATLINEPAUSE.PAUSEDAT, utc(pause.pausedAt()))
                        .set(DEVICEFLATLINEPAUSE.RESUMESAT, utc(pause.resumesAt()))
                        .set(DEVICEFLATLINEPAUSE.PAUSEDBYUSERID, pause.pausedByUserId())
                        .onConflict(DEVICEFLATLINEPAUSE.DEVICEID, DEVICEFLATLINEPAUSE.METRIC)
                        .doUpdate()
                        .set(DEVICEFLATLINEPAUSE.ESTATEID, estateId)
                        .set(DEVICEFLATLINEPAUSE.ASSETID, device.assetId())
                        .set(DEVICEFLATLINEPAUSE.PAUSEDAT, utc(pause.pausedAt()))
                        .set(DEVICEFLATLINEPAUSE.RESUMESAT, utc(pause.resumesAt()))
                        .set(DEVICEFLATLINEPAUSE.PAUSEDBYUSERID, pause.pausedByUserId())
                        .where(DEVICEFLATLINEPAUSE.RESUMESAT.le(utc(pause.pausedAt())))
                        .execute()
                == 1;
    }

    /** Includes future-only/pre-pause series so absence of eligible evidence is explicit. */
    Set<Series> recordedSeries(UUID estateId) {
        return db.selectDistinct(DEVICEREADING.DEVICEID, DEVICEREADING.METRIC)
                .from(DEVICEREADING)
                .join(DEVICE)
                .on(currentDeviceReading())
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICE.ASSETID), ASSET.ESTATEID.eq(DEVICE.ESTATEID))
                .where(DEVICE.ESTATEID.eq(estateId), ASSET.DEACTIVATEDAT.isNull(), DEVICE.DEACTIVATEDAT.isNull())
                .fetchSet(row -> new Series(
                        row.get(DEVICEREADING.DEVICEID), DeviceMetric.valueOf(row.get(DEVICEREADING.METRIC))));
    }

    /**
     * One ordered query for all scoped histories, using the existing device/metric/time index.
     * No history limit: late arrivals and tolerance edits must be able to change the result.
     */
    Map<Series, List<FlatlineDetector.Reading>> readings(UUID estateId, Instant checkedAt) {
        var result = new HashMap<Series, List<FlatlineDetector.Reading>>();
        try (var rows = db.select(
                        DEVICEREADING.DEVICEID, DEVICEREADING.METRIC, DEVICEREADING.MEASUREDAT, DEVICEREADING.VALUE)
                .from(DEVICEREADING)
                .join(DEVICE)
                .on(currentDeviceReading())
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICE.ASSETID), ASSET.ESTATEID.eq(DEVICE.ESTATEID))
                .where(
                        DEVICE.ESTATEID.eq(estateId),
                        ASSET.DEACTIVATEDAT.isNull(),
                        DEVICE.DEACTIVATEDAT.isNull(),
                        DEVICEREADING.MEASUREDAT.le(utc(checkedAt)))
                .orderBy(DEVICEREADING.DEVICEID, DEVICEREADING.METRIC, DEVICEREADING.MEASUREDAT)
                .fetchLazy()) {
            for (var row : rows) {
                var series = new Series(
                        row.get(DEVICEREADING.DEVICEID), DeviceMetric.valueOf(row.get(DEVICEREADING.METRIC)));
                result.computeIfAbsent(series, ignored -> new ArrayList<>())
                        .add(new FlatlineDetector.Reading(
                                row.get(DEVICEREADING.MEASUREDAT).toInstant(), row.get(DEVICEREADING.VALUE), true));
            }
        }
        return result;
    }

    private static Condition currentDeviceReading() {
        return DEVICE.ID
                .eq(DEVICEREADING.DEVICEID)
                .and(DEVICE.ESTATEID.eq(DEVICEREADING.ESTATEID))
                .and(DEVICE.ASSETID.eq(DEVICEREADING.ASSETID))
                .and(DSL.condition("{0} = ANY({1})", DEVICEREADING.METRIC, DEVICE.METRICS));
    }

    private static OffsetDateTime utc(Instant at) {
        return at.atOffset(ZoneOffset.UTC);
    }
}
