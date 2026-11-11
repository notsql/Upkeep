package com.proj.server.notification;

import com.proj.server.category.ServiceIntervalService;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AsseteventRecord;
import com.proj.server.event.AssetEventRepository;
import com.proj.server.event.AssetEventService;
import com.proj.server.risk.FailureRiskBasis;
import com.proj.server.risk.FailureRiskCalculator;
import com.proj.server.risk.FailureRiskConstants;
import com.proj.server.risk.Forecast;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Raises and resolves date-driven reminders once per estate per Singapore day, on the first read of a manager's
 * notifications (spec notifications.md, Decision 3). Each estate is swept in a savepoint, so a failing sweep is
 * rolled back, retried on the next read, and never fails the read itself.
 */
@Service
public class NotificationSweeper {
    private static final Logger LOG = LoggerFactory.getLogger(NotificationSweeper.class);
    static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final NotificationSweepRepository repository;
    private final NotificationSettingsService settings;
    private final ServiceIntervalService intervals;
    private final AssetEventRepository events;
    private final FailureRiskCalculator calculator;
    private final TransactionTemplate savepoint;

    public NotificationSweeper(
            NotificationSweepRepository repository,
            NotificationSettingsService settings,
            ServiceIntervalService intervals,
            AssetEventRepository events,
            FailureRiskCalculator calculator,
            PlatformTransactionManager transactions) {
        this.repository = repository;
        this.settings = settings;
        this.intervals = intervals;
        this.events = events;
        this.calculator = calculator;
        this.savepoint = new TransactionTemplate(transactions);
        this.savepoint.setPropagationBehavior(TransactionDefinition.PROPAGATION_NESTED);
    }

    /** Sweeps each active estate the user manages that has not been swept today. */
    public void sweep(String user) {
        var today = NotificationDays.today();
        for (var estateId : repository.managedActiveEstates(user)) {
            try {
                savepoint.executeWithoutResult(status -> {
                    if (repository.claim(estateId, today)) {
                        sweepEstate(estateId, today);
                    }
                });
            } catch (RuntimeException failure) {
                LOG.warn(
                        "Notification sweep of estate {} failed; it will be retried on the next read.",
                        estateId,
                        failure);
            }
        }
    }

    private void sweepEstate(UUID estateId, LocalDate today) {
        var assets = repository.activeAssets(estateId);
        var switches = settings.forEstate(estateId);
        var busy = repository.assetsWithOpenWorkOrders(estateId);
        sweepServiceDue(estateId, today, assets, switches.serviceDueEnabled(), busy);
        sweepRepairPredicted(estateId, today, assets, switches.repairPredictedEnabled(), busy);
    }

    /** ID-103: one reminder per milestone (90, 60, 30, 14 days) before the asset's interval due date. */
    private void sweepServiceDue(
            UUID estateId, LocalDate today, List<AssetRecord> assets, boolean enabled, Set<UUID> busy) {
        var effective = intervals.effectiveForEstate(estateId, assets);
        var inspected = repository.lastInspections(estateId);
        var open = repository.openReminders(estateId, NotificationType.SERVICE_DUE);
        var fired = repository.firedServiceMilestones(estateId);
        var qualifying = new HashSet<UUID>();
        for (var asset : assets) {
            var interval = effective.get(asset.getId());
            var base = inspected.getOrDefault(asset.getId(), asset.getInstalledon());
            if (interval == null || interval.interval() == null || base == null || busy.contains(asset.getId())) {
                continue;
            }
            var dueOn = interval.interval().after(base);
            var milestone = NotificationMilestones.serviceDue(dueOn, today);
            if (milestone == null) {
                continue;
            }
            qualifying.add(asset.getId());
            var current = open.get(asset.getId());
            var step = NotificationMilestones.serviceStep(
                    current, fired.contains(new ServiceMilestone(asset.getId(), dueOn, milestone)), milestone, enabled);
            switch (step) {
                case BACKFILL -> repository.markMilestone(current.id(), milestone);
                case RAISE -> {
                    if (current != null) {
                        repository.resolve(current.id());
                    }
                    repository.insertServiceDue(
                            estateId,
                            asset.getId(),
                            serviceSummary(dueOn, today, milestone),
                            dueOn,
                            interval,
                            milestone);
                }
                case KEEP -> {}
            }
        }
        repository.resolveExcept(estateId, NotificationType.SERVICE_DUE, qualifying);
    }

    /** ID-101: one reminder per forecast window (90, 60, 30 days), only ever moving nearer. */
    private void sweepRepairPredicted(
            UUID estateId, LocalDate today, List<AssetRecord> assets, boolean enabled, Set<UUID> busy) {
        var history =
                events.listForEstate(estateId).stream().collect(Collectors.groupingBy(AsseteventRecord::getAssetid));
        var open = repository.openReminders(estateId, NotificationType.REPAIR_PREDICTED);
        var qualifying = new HashSet<UUID>();
        for (var asset : assets) {
            if (!FailureRiskConstants.SILENT_FAILURE_CATEGORIES.contains(asset.getCategory())
                    || busy.contains(asset.getId())) {
                continue;
            }
            var forecast = calculator.forecast(
                    AssetEventService.riskAsset(asset),
                    history.getOrDefault(asset.getId(), List.of()).stream()
                            .map(AssetEventService::riskEvent)
                            .toList(),
                    today);
            var window = windowDays(forecast);
            if (window == null) {
                continue;
            }
            qualifying.add(asset.getId());
            var current = open.get(asset.getId());
            switch (NotificationMilestones.repairStep(current, window, enabled)) {
                case BACKFILL -> repository.markMilestone(current.id(), window);
                case RAISE -> {
                    if (current != null) {
                        repository.resolve(current.id());
                    }
                    var probability = probability(forecast);
                    repository.insertRepairPredicted(
                            estateId, asset.getId(), repairSummary(window, probability), forecast, probability, window);
                }
                case KEEP -> {}
            }
        }
        repository.resolveExcept(estateId, NotificationType.REPAIR_PREDICTED, qualifying);
    }

    /** 30, 60 or 90 for a usable forecast window, else null. */
    private static Integer windowDays(Forecast forecast) {
        if (forecast.recommendedTimeframe() == null
                || (forecast.basis() != FailureRiskBasis.ASSET_HISTORY
                        && forecast.basis() != FailureRiskBasis.SERVICE_INTERVAL)) {
            return null;
        }
        return switch (forecast.recommendedTimeframe()) {
            case WITHIN_30_DAYS -> 30;
            case WITHIN_60_DAYS -> 60;
            case WITHIN_90_DAYS -> 90;
            case BEYOND_90_DAYS -> null;
        };
    }

    /** The probability of the forecast's window: the notification's confidence level. */
    private static double probability(Forecast forecast) {
        return switch (forecast.recommendedTimeframe()) {
            case WITHIN_30_DAYS -> forecast.probability30Days();
            case WITHIN_60_DAYS -> forecast.probability60Days();
            default -> forecast.probability90Days();
        };
    }

    static String repairSummary(int window, double probability) {
        return "Repair likely within " + window + " days (" + Math.round(probability * 100) + "% chance)";
    }

    static String serviceSummary(LocalDate dueOn, LocalDate today, int milestone) {
        if (dueOn.isBefore(today)) {
            return "Service overdue since " + DATE.format(dueOn);
        }
        if (milestone <= 14) {
            return "Service due on " + DATE.format(dueOn);
        }
        return "Service due in " + milestone + " days (on " + DATE.format(dueOn) + ")";
    }

    /** A service reminder already raised (open or resolved) for one asset, due date and milestone. */
    record ServiceMilestone(UUID assetId, LocalDate dueOn, int milestoneDays) {}
}
