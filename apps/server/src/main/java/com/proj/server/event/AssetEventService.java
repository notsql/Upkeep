package com.proj.server.event;

import com.proj.server.asset.AssetRepository;
import com.proj.server.catalogue.CatalogueRepository;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AsseteventRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.risk.FailureRiskCalculator;
import com.proj.server.risk.RiskAsset;
import com.proj.server.risk.RiskEvent;
import com.proj.server.workos.WorkOSService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Events are append-only: this service only lists and inserts. */
@Service
public class AssetEventService {
    // The latest "today" anywhere, as for assessments: a date is only "in the future" if it is
    // in the future everywhere.
    private static final ZoneOffset LATEST_TIME_ZONE = ZoneOffset.ofHours(14);

    private final AssetEventRepository repository;
    private final AssetRepository assets;
    private final EstateRepository estates;
    private final CatalogueRepository catalogue;
    private final FailureRiskCalculator calculator;
    private final WorkOSService workOS;

    public AssetEventService(
            AssetEventRepository repository,
            AssetRepository assets,
            EstateRepository estates,
            CatalogueRepository catalogue,
            FailureRiskCalculator calculator,
            WorkOSService workOS) {
        this.repository = repository;
        this.assets = assets;
        this.estates = estates;
        this.catalogue = catalogue;
        this.calculator = calculator;
        this.workOS = workOS;
    }

    /** Includes a deactivated asset's events: they are kept, only closed to new entries. */
    public List<AssetEventResponse> list(UUID estateId, UUID assetId, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(AssetEventService::estateNotFound);
        var asset = assets.find(assetId, estateId, false).orElseThrow(AssetEventService::assetNotFound);
        var names = new Names(catalogue);
        return repository.listForAsset(assetId).stream()
                .map(event -> response(event, asset, names))
                .toList();
    }

    @Transactional
    public AssetEventResponse record(UUID estateId, UUID assetId, String owner, CreateAssetEventRequest request) {
        if (request.occurredOn().isAfter(LocalDate.now(LATEST_TIME_ZONE))) {
            throw new AssetEventException(
                    HttpStatus.BAD_REQUEST, "occurredOn: the event date cannot be in the future.");
        }
        // Looked up before any row is locked, so a slow WorkOS call never holds a lock.
        var recordedByName = workOS.findDisplayName(owner).orElse(null);

        var estate = estates.findOwned(estateId, owner, true).orElseThrow(AssetEventService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new AssetEventException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its assets cannot have new events.");
        }
        var asset = assets.find(assetId, estateId, true).orElseThrow(AssetEventService::assetNotFound);
        if (asset.getDeactivatedat() != null) {
            throw new AssetEventException(
                    HttpStatus.CONFLICT,
                    "This asset is deactivated. Its events are kept, but new ones are not accepted.");
        }
        if (asset.getInstalledon() != null && request.occurredOn().isBefore(asset.getInstalledon())) {
            throw new AssetEventException(
                    HttpStatus.BAD_REQUEST, "occurredOn: the event date cannot be before the asset was installed.");
        }
        var event = repository.create(
                estateId, assetId, request, asset.getManufacturerid(), asset.getModelid(), owner, recordedByName);
        return response(event, asset, new Names(catalogue));
    }

    /** What the forecast needs from an asset. */
    public static RiskAsset riskAsset(AssetRecord asset) {
        return new RiskAsset(
                asset.getCategory(), asset.getInstalledon(), asset.getManufacturerid(), asset.getModelid());
    }

    /** What the forecast needs from an event. */
    public static RiskEvent riskEvent(AsseteventRecord event) {
        return new RiskEvent(
                AssetEventType.valueOf(event.getType()),
                event.getOccurredon(),
                event.getManufacturerid(),
                event.getModelid());
    }

    private AssetEventResponse response(AsseteventRecord event, AssetRecord asset, Names names) {
        var type = AssetEventType.valueOf(event.getType());
        return new AssetEventResponse(
                event.getId(),
                event.getAssetid(),
                type.category(),
                type,
                event.getOccurredon(),
                event.getNotes(),
                names.manufacturer(event.getManufacturerid()),
                names.model(event.getModelid()),
                calculator.counts(riskAsset(asset), riskEvent(event)),
                event.getRecordedbyuserid(),
                event.getRecordedbyname(),
                event.getCreatedat(),
                event.getFindings(),
                event.getWorkperformed(),
                event.getServiceprovider(),
                event.getPartsreplaced(),
                event.getDowntimeminutes(),
                plain(event.getLabourcost()),
                plain(event.getPartscost()),
                plain(event.getOthercost()),
                total(event.getLabourcost(), event.getPartscost(), event.getOthercost()));
    }

    private static String plain(BigDecimal cost) {
        return cost == null ? null : cost.toPlainString();
    }

    /** Unknown when any cost is unknown, as for work-order completions. */
    private static String total(BigDecimal... costs) {
        var sum = BigDecimal.ZERO.setScale(2);
        for (var cost : costs) {
            if (cost == null) {
                return null;
            }
            sum = sum.add(cost);
        }
        return sum.toPlainString();
    }

    /** Catalogue names, looked up once per ID within one response. */
    private static final class Names {
        private final CatalogueRepository catalogue;
        private final HashMap<UUID, String> manufacturers = new HashMap<>();
        private final HashMap<UUID, String> models = new HashMap<>();

        Names(CatalogueRepository catalogue) {
            this.catalogue = catalogue;
        }

        String manufacturer(UUID id) {
            return id == null ? null : manufacturers.computeIfAbsent(id, catalogue::manufacturerName);
        }

        String model(UUID id) {
            return id == null ? null : models.computeIfAbsent(id, catalogue::modelName);
        }
    }

    private static AssetEventException estateNotFound() {
        return new AssetEventException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static AssetEventException assetNotFound() {
        return new AssetEventException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
