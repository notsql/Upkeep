package com.proj.server.cost;

import com.proj.server.category.ServiceIntervalService;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AsseteventRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.event.AssetEventRepository;
import com.proj.server.event.AssetEventService;
import com.proj.server.risk.FailureRiskCalculator;
import com.proj.server.risk.FailureRiskConstants;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Estate-wide cost views for the owner's dashboard (spec estate-costs.md). Computed on read. */
@Service
public class EstateCostService {
    static final int TOP = 5;
    static final int FORECAST_MONTHS = 12;
    static final int REPAIR_HORIZON_DAYS = 365;
    private static final ZoneId SINGAPORE = ZoneId.of("Asia/Singapore");

    private final EstateRepository estates;
    private final EstateCostRepository repository;
    private final ServiceIntervalService intervals;
    private final AssetEventRepository events;
    private final FailureRiskCalculator calculator;

    public EstateCostService(
            EstateRepository estates,
            EstateCostRepository repository,
            ServiceIntervalService intervals,
            AssetEventRepository events,
            FailureRiskCalculator calculator) {
        this.estates = estates;
        this.repository = repository;
        this.intervals = intervals;
        this.events = events;
        this.calculator = calculator;
    }

    /** ID-34: the five active assets with the highest known spend, highest first, ties by reference. */
    @Transactional(readOnly = true)
    public List<CostliestAssetResponse> costliest(UUID estateId, String user) {
        owned(estateId, user);
        var spend = new HashMap<UUID, BigDecimal>();
        var unknown = new HashMap<UUID, Integer>();
        for (var entry : repository.entries(estateId)) {
            spend.merge(entry.assetId(), entry.known(), BigDecimal::add);
            if (entry.anyUnknown()) {
                unknown.merge(entry.assetId(), 1, Integer::sum);
            }
        }
        var labels = repository.categoryLabels();
        return repository.activeAssets(estateId).stream()
                .filter(asset ->
                        spend.getOrDefault(asset.getId(), BigDecimal.ZERO).signum() > 0)
                .sorted(Comparator.<AssetRecord, BigDecimal>comparing(asset -> spend.get(asset.getId()))
                        .reversed()
                        .thenComparing(AssetRecord::getReference))
                .limit(TOP)
                .map(asset -> new CostliestAssetResponse(
                        asset.getId(),
                        asset.getReference(),
                        asset.getName(),
                        asset.getCategory(),
                        labels.getOrDefault(asset.getCategory(), asset.getCategory()),
                        money(spend.get(asset.getId())),
                        unknown.getOrDefault(asset.getId(), 0)))
                .toList();
    }

    /**
     * ID-33: scheduled services (interval × average service cost) plus predicted repairs (365-day breakdown
     * probability × average repair cost) over the next 12 months, for active assets. Unit costs come from the
     * asset's own history, else its category's in the estate; assets with neither are left out and counted.
     */
    @Transactional(readOnly = true)
    public BudgetForecastResponse forecast(UUID estateId, String user) {
        owned(estateId, user);
        var from = LocalDate.now(SINGAPORE);
        var to = from.plusMonths(FORECAST_MONTHS);
        var entries = repository.entries(estateId);
        var serviceCost = new UnitCosts(entries, CostEntry::preventive);
        var repairCost = new UnitCosts(entries, CostEntry::repair);
        var assets = repository.activeAssets(estateId);
        var effective = intervals.effectiveForEstate(estateId, assets);
        var inspected = repository.lastInspections(estateId);
        var history =
                events.listForEstate(estateId).stream().collect(Collectors.groupingBy(AsseteventRecord::getAssetid));

        var servicesTotal = BigDecimal.ZERO;
        var repairsTotal = BigDecimal.ZERO;
        int services = 0;
        double expectedRepairs = 0;
        var withoutBasis = new HashSet<UUID>();
        for (var asset : assets) {
            var interval = effective.get(asset.getId());
            var base = inspected.getOrDefault(asset.getId(), asset.getInstalledon());
            if (interval != null && interval.interval() != null && base != null) {
                int count = 0;
                var next = interval.interval().after(base);
                for (next = next.isBefore(from) ? from : next;
                        next.isBefore(to);
                        next = interval.interval().after(next)) {
                    count++;
                }
                if (count > 0) {
                    var unit = serviceCost.of(asset);
                    if (unit == null) {
                        withoutBasis.add(asset.getId());
                    } else {
                        servicesTotal = servicesTotal.add(unit.multiply(BigDecimal.valueOf(count)));
                        services += count;
                    }
                }
            }
            if (FailureRiskConstants.SILENT_FAILURE_CATEGORIES.contains(asset.getCategory())) {
                var probability = calculator.probabilityWithin(
                        AssetEventService.riskAsset(asset),
                        history.getOrDefault(asset.getId(), List.of()).stream()
                                .map(AssetEventService::riskEvent)
                                .toList(),
                        from,
                        REPAIR_HORIZON_DAYS);
                if (probability != null) {
                    var unit = repairCost.of(asset);
                    if (unit == null) {
                        withoutBasis.add(asset.getId());
                    } else {
                        repairsTotal = repairsTotal.add(unit.multiply(BigDecimal.valueOf(probability)));
                        expectedRepairs += probability;
                    }
                }
            }
        }
        var services2 = cents(servicesTotal);
        var repairs2 = cents(repairsTotal);
        return new BudgetForecastResponse(
                from,
                to,
                services2.add(repairs2).toPlainString(),
                new BudgetForecastResponse.ScheduledServices(services2.toPlainString(), services),
                new BudgetForecastResponse.PredictedRepairs(
                        repairs2.toPlainString(),
                        BigDecimal.valueOf(expectedRepairs)
                                .setScale(2, RoundingMode.HALF_UP)
                                .doubleValue()),
                withoutBasis.size());
    }

    /** Average known cost per entry of one kind, by asset and by category; null when there is no history. */
    private static final class UnitCosts {
        private final Map<UUID, BigDecimal> byAsset;
        private final Map<String, BigDecimal> byCategory;

        UnitCosts(List<CostEntry> entries, Predicate<CostEntry> kind) {
            var priced =
                    entries.stream().filter(kind).filter(CostEntry::anyKnown).toList();
            byAsset = priced.stream()
                    .collect(Collectors.groupingBy(
                            CostEntry::assetId, Collectors.collectingAndThen(Collectors.toList(), UnitCosts::average)));
            byCategory = priced.stream()
                    .collect(Collectors.groupingBy(
                            CostEntry::category,
                            Collectors.collectingAndThen(Collectors.toList(), UnitCosts::average)));
        }

        BigDecimal of(AssetRecord asset) {
            var own = byAsset.get(asset.getId());
            return own != null ? own : byCategory.get(asset.getCategory());
        }

        private static BigDecimal average(List<CostEntry> entries) {
            var sum = entries.stream().map(CostEntry::known).reduce(BigDecimal.ZERO, BigDecimal::add);
            return sum.divide(BigDecimal.valueOf(entries.size()), MathContext.DECIMAL128);
        }
    }

    private static BigDecimal cents(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    static String money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private void owned(UUID estateId, String user) {
        estates.findOwned(estateId, user, false)
                .orElseThrow(() -> new EstateCostException(HttpStatus.NOT_FOUND, "Estate not found."));
    }
}
