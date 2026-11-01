package com.proj.server.inspectionlist;

import com.proj.server.category.AssetCategorySettingsRepository;
import com.proj.server.category.AssetCategorySettingsService;
import com.proj.server.category.EffectiveInterval;
import com.proj.server.category.IntervalSource;
import com.proj.server.category.ServiceInterval;
import com.proj.server.category.ServiceIntervalService;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AsseteventRecord;
import com.proj.server.db.tables.records.AssetinspectionresultRecord;
import com.proj.server.db.tables.records.InspectioncheckRecord;
import com.proj.server.db.tables.records.LocationRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.event.AssetEventRepository;
import com.proj.server.event.AssetEventService;
import com.proj.server.inspection.InspectionOutcome;
import com.proj.server.risk.FailureRiskCalculator;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The monthly inspection list (ID-84) with overdue checks (ID-86). Owners and assigned Managers read
 * and generate it; spec monthly-inspection-list.md.
 */
@Service
public class InspectionListService {
    static final ZoneId SINGAPORE = ZoneId.of("Asia/Singapore");

    /** Block, then block-wide before levels in their order, then status, due date and reference. */
    private static final Comparator<Row> ORDER = Comparator.comparing(
                    (Row row) -> row.check().block().name())
            .thenComparing(row -> row.check().block().id())
            .thenComparing(Row::levelOrder, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(row ->
                    row.check().level() == null ? "" : row.check().level().name())
            .thenComparing(row -> row.check().status())
            .thenComparing(row -> row.check().dueOn())
            .thenComparing(row -> row.check().assetReference());

    private record Row(InspectionCheckResponse check, Integer levelOrder) {}

    private final InspectionListRepository repository;
    private final AssetCategorySettingsService categorySettings;
    private final AssetCategorySettingsRepository categories;
    private final ServiceIntervalService intervals;
    private final AssetEventRepository events;
    private final FailureRiskCalculator calculator;
    private final EstateRepository estates;
    private final WorkOSService workOS;

    public InspectionListService(
            InspectionListRepository repository,
            AssetCategorySettingsService categorySettings,
            AssetCategorySettingsRepository categories,
            ServiceIntervalService intervals,
            AssetEventRepository events,
            FailureRiskCalculator calculator,
            EstateRepository estates,
            WorkOSService workOS) {
        this.repository = repository;
        this.categorySettings = categorySettings;
        this.categories = categories;
        this.intervals = intervals;
        this.events = events;
        this.calculator = calculator;
        this.estates = estates;
        this.workOS = workOS;
    }

    @Transactional(readOnly = true)
    public InspectionListResponse list(UUID estateId, String user) {
        var estate = managed(estateId, user);
        return response(estate, LocalDate.now(SINGAPORE));
    }

    /** Adds a check for each asset due this month with no open check; never duplicates. */
    @Transactional
    public GenerateInspectionListResponse generate(UUID estateId, String user) {
        // Looked up before any row is locked, so a slow WorkOS call never holds a lock.
        var name = workOS.findDisplayName(user).orElse(null);
        var estate = managed(estateId, user);
        if (estate.deactivatedAt() != null) {
            throw new InspectionListException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its inspection list cannot be generated.");
        }
        repository.lockEstate(estateId);
        var today = LocalDate.now(SINGAPORE);
        var month = today.withDayOfMonth(1);
        var monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        var checked = repository.checked(estateId, month);
        var plan = plan(estateId, today, month);
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var added = 0;
        for (var entry : plan.due().entrySet()) {
            var due = entry.getValue();
            if (checked.contains(entry.getKey()) || due.dueOn().isAfter(monthEnd)) {
                continue;
            }
            var interval = due.basis() == DueBasis.INTERVAL ? plan.intervals().get(entry.getKey()) : null;
            repository.insertCheck(
                    estateId,
                    entry.getKey(),
                    month,
                    due,
                    interval == null ? null : interval.interval(),
                    interval == null ? null : interval.source(),
                    user,
                    name,
                    now);
            added++;
        }
        repository.insertRun(estateId, month, added, user, name, now);
        return new GenerateInspectionListResponse(added, response(estate, today));
    }

    private record Plan(
            Map<UUID, DueDates.Due> due, List<AssetRecord> unscheduled, Map<UUID, EffectiveInterval> intervals) {}

    /** The due date of every eligible asset, and the ones that cannot be scheduled. */
    private Plan plan(UUID estateId, LocalDate today, LocalDate month) {
        var eligible = repository.eligibleAssets(estateId, categorySettings.flaggedCategories(estateId));
        var last = repository.lastInspections(estateId);
        var effective = intervals.effectiveForEstate(estateId, eligible);
        var history =
                events.listForEstate(estateId).stream().collect(Collectors.groupingBy(AsseteventRecord::getAssetid));
        var due = new LinkedHashMap<UUID, DueDates.Due>();
        var unscheduled = new ArrayList<AssetRecord>();
        for (var asset : eligible) {
            var forecast = calculator.forecast(
                    AssetEventService.riskAsset(asset),
                    history.getOrDefault(asset.getId(), List.of()).stream()
                            .map(AssetEventService::riskEvent)
                            .toList(),
                    today);
            var next = DueDates.due(
                    last.get(asset.getId()),
                    asset.getInstalledon(),
                    effective.get(asset.getId()).interval(),
                    forecast.recommendedTimeframe(),
                    today,
                    month);
            if (next == null) {
                unscheduled.add(asset);
            } else {
                due.put(asset.getId(), next);
            }
        }
        return new Plan(due, unscheduled, effective);
    }

    private InspectionListResponse response(EstateResponse estate, LocalDate today) {
        var estateId = estate.id();
        var month = today.withDayOfMonth(1);
        var checks = repository.listed(estateId, month);
        var assets = repository
                .assets(checks.stream().map(InspectioncheckRecord::getAssetid).toList())
                .stream()
                .collect(Collectors.toMap(AssetRecord::getId, Function.identity()));
        var results = repository.results(checks.stream()
                .map(InspectioncheckRecord::getCompletedbyresultid)
                .filter(id -> id != null)
                .toList());
        var labels = labels();
        var locations = repository.locations(estateId);
        var listed = checks.stream()
                .map(check -> row(check, assets.get(check.getAssetid()), results, labels, locations, month))
                .sorted(ORDER)
                .map(Row::check)
                .toList();
        var open = checks.stream()
                .filter(check -> check.getCompletedbyresultid() == null)
                .map(InspectioncheckRecord::getAssetid)
                .collect(Collectors.toSet());
        var unscheduled = plan(estateId, today, month).unscheduled().stream()
                .filter(asset -> !open.contains(asset.getId()))
                .sorted(Comparator.comparing(AssetRecord::getReference))
                .map(asset -> new UnscheduledAssetResponse(
                        asset.getId(), asset.getReference(), asset.getName(), label(labels, asset.getCategory())))
                .toList();
        var run = repository.latestRun(estateId, month).orElse(null);
        return new InspectionListResponse(
                month,
                estate.deactivatedAt() == null,
                run == null ? null : run.getGeneratedat(),
                run == null ? null : run.getGeneratedbyname(),
                count(listed, CheckStatus.OVERDUE),
                count(listed, CheckStatus.DUE),
                count(listed, CheckStatus.DONE),
                listed,
                unscheduled,
                categorySettings.flaggedCategories(estateId).size());
    }

    private static Row row(
            InspectioncheckRecord check,
            AssetRecord asset,
            Map<UUID, AssetinspectionresultRecord> results,
            Map<String, String> labels,
            Map<UUID, LocationRecord> locations,
            LocalDate month) {
        var result = check.getCompletedbyresultid() == null ? null : results.get(check.getCompletedbyresultid());
        CheckStatus status;
        if (result != null) {
            status = CheckStatus.DONE;
        } else if (check.getMonth().isBefore(month)) {
            status = CheckStatus.OVERDUE;
        } else {
            status = CheckStatus.DUE;
        }
        var place = place(locations, asset.getLocationid());
        var response = new InspectionCheckResponse(
                check.getId(),
                asset.getId(),
                asset.getReference(),
                asset.getName(),
                label(labels, asset.getCategory()),
                place.block(),
                place.level(),
                check.getDueon(),
                DueBasis.valueOf(check.getDuebasis()),
                ServiceInterval.of(check.getIntervalvalue(), check.getIntervalunit()),
                check.getIntervalsource() == null ? null : IntervalSource.valueOf(check.getIntervalsource()),
                status,
                result == null
                        ? null
                        : new CheckResultResponse(
                                result.getId(),
                                InspectionOutcome.valueOf(result.getOutcome()),
                                result.getInspectedon()));
        return new Row(response, place.levelOrder());
    }

    private record Place(InspectionLocationResponse block, InspectionLocationResponse level, Integer levelOrder) {}

    /** The block and level of a location: a level's common area belongs to that level. */
    private static Place place(Map<UUID, LocationRecord> locations, UUID locationId) {
        var location = locations.get(locationId);
        if ("COMMON_AREA".equals(location.getType())) {
            location = locations.get(location.getParentid());
        }
        if ("LEVEL".equals(location.getType())) {
            var block = locations.get(location.getParentid());
            return new Place(ref(block), ref(location), location.getSortorder());
        }
        return new Place(ref(location), null, null);
    }

    private static InspectionLocationResponse ref(LocationRecord location) {
        return new InspectionLocationResponse(location.getId(), location.getName());
    }

    private Map<String, String> labels() {
        return categories.categories().stream()
                .collect(Collectors.toMap(category -> category.getCode(), category -> category.getLabel()));
    }

    private static String label(Map<String, String> labels, String code) {
        return labels.getOrDefault(code, code);
    }

    private static int count(List<InspectionCheckResponse> checks, CheckStatus status) {
        return (int) checks.stream().filter(check -> check.status() == status).count();
    }

    private EstateResponse managed(UUID estateId, String user) {
        return estates.findManaged(estateId, user)
                .orElseThrow(() -> new InspectionListException(HttpStatus.NOT_FOUND, "Estate not found."));
    }
}
