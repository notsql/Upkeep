package com.proj.server.risk;

import com.proj.server.asset.AssetCondition;
import com.proj.server.asset.AssetRepository;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AsseteventRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.event.AssetEventRepository;
import com.proj.server.event.AssetEventService;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Forecasts are derived on read from the counting events (decision 0020). Nothing here is stored. */
@Service
public class FailureRiskService {
    private static final Comparator<FailureRiskResponse> ESTATE_ORDER = Comparator.comparing(
                    FailureRiskResponse::flagged)
            .reversed()
            .thenComparing(FailureRiskResponse::probability90Days, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(FailureRiskResponse::assetReference);

    private final FailureRiskRepository repository;
    private final AssetRepository assets;
    private final AssetEventRepository events;
    private final EstateRepository estates;
    private final FailureRiskCalculator calculator;

    public FailureRiskService(
            FailureRiskRepository repository,
            AssetRepository assets,
            AssetEventRepository events,
            EstateRepository estates,
            FailureRiskCalculator calculator) {
        this.repository = repository;
        this.assets = assets;
        this.events = events;
        this.estates = estates;
        this.calculator = calculator;
    }

    /** Readable for a deactivated asset and for any category: non-pumps get basis NOT_SUPPORTED. */
    public FailureRiskResponse forAsset(UUID estateId, UUID assetId, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(FailureRiskService::estateNotFound);
        var asset = assets.find(assetId, estateId, false)
                .orElseThrow(() -> new FailureRiskException(HttpStatus.NOT_FOUND, "Asset not found."));
        return response(asset, events.listForAsset(assetId), today());
    }

    /** The estate's active assets in silent-failure categories, flagged first, then by 90-day risk. */
    public List<FailureRiskResponse> forEstate(UUID estateId, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(FailureRiskService::estateNotFound);
        var byAsset =
                events.listForEstate(estateId).stream().collect(Collectors.groupingBy(AsseteventRecord::getAssetid));
        var today = today();
        return repository.activeAssets(estateId, FailureRiskConstants.SILENT_FAILURE_CATEGORIES).stream()
                .map(asset -> response(asset, byAsset.getOrDefault(asset.getId(), List.of()), today))
                .sorted(ESTATE_ORDER)
                .toList();
    }

    private FailureRiskResponse response(AssetRecord asset, List<AsseteventRecord> assetEvents, LocalDate today) {
        var forecast = calculator.forecast(
                AssetEventService.riskAsset(asset),
                assetEvents.stream().map(AssetEventService::riskEvent).toList(),
                today);
        var reasons = new ArrayList<FailureRiskFlagReason>();
        var condition = assets.currentCondition(asset.getId());
        if (condition == AssetCondition.NEEDS_ATTENTION || condition == AssetCondition.FAULTY) {
            reasons.add(FailureRiskFlagReason.CONDITION);
        }
        if (forecast.probability90Days() != null
                && forecast.probability90Days() >= FailureRiskConstants.RISK_THRESHOLD) {
            reasons.add(FailureRiskFlagReason.FAILURE_RISK);
        }
        if (forecast.nearingEndOfLife()) {
            reasons.add(FailureRiskFlagReason.END_OF_LIFE);
        }
        return new FailureRiskResponse(
                asset.getId(),
                asset.getReference(),
                asset.getName(),
                asset.getCategory(),
                forecast.basis(),
                forecast.failuresObserved(),
                forecast.daysSinceLastEvent(),
                forecast.probability30Days(),
                forecast.probability60Days(),
                forecast.probability90Days(),
                forecast.recommendedTimeframe(),
                forecast.expectedEndOfLife(),
                !reasons.isEmpty(),
                List.copyOf(reasons));
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private static FailureRiskException estateNotFound() {
        return new FailureRiskException(HttpStatus.NOT_FOUND, "Estate not found.");
    }
}
