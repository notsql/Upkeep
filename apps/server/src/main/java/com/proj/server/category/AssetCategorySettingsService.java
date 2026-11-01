package com.proj.server.category;

import com.proj.server.db.tables.records.AssetcategoryRecord;
import com.proj.server.db.tables.records.AssetcategoryflagchangeRecord;
import com.proj.server.db.tables.records.AssetcategoryintervalchangeRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.workos.WorkOSService;
import java.util.Comparator;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * An estate's silent-failure flag (ID-83) and service interval (ID-81) per asset category. The
 * owner and assigned Managers read and change them; until changed, only LIGHTING is flagged and no
 * category has an interval.
 */
@Service
public class AssetCategorySettingsService {
    static final String FLAGGED_BY_DEFAULT = "LIGHTING";

    private final AssetCategorySettingsRepository repository;
    private final ServiceIntervalRepository intervals;
    private final EstateRepository estates;
    private final WorkOSService workOS;

    public AssetCategorySettingsService(
            AssetCategorySettingsRepository repository,
            ServiceIntervalRepository intervals,
            EstateRepository estates,
            WorkOSService workOS) {
        this.repository = repository;
        this.intervals = intervals;
        this.estates = estates;
        this.workOS = workOS;
    }

    public EstateAssetCategoriesResponse list(UUID estateId, String user) {
        var estate = managed(estateId, user);
        var changes = repository.latestChanges(estateId);
        var intervalChanges = intervals.latestCategoryChanges(estateId);
        var counts = repository.activeAssetCounts(estateId);
        var categories = repository.categories().stream()
                .map(category -> response(
                        category.getCode(),
                        category.getLabel(),
                        changes.get(category.getCode()),
                        intervalChanges.get(category.getCode()),
                        counts.getOrDefault(category.getCode(), 0)))
                // Stable, so each group keeps the repository's label order.
                .sorted(Comparator.comparing((EstateAssetCategoryResponse category) -> !category.failsSilently()))
                .toList();
        return new EstateAssetCategoriesResponse(estate.deactivatedAt() == null, categories);
    }

    /** Records a change only when the flag actually changes, so the history holds real changes. */
    @Transactional
    public EstateAssetCategoryResponse setSilentFailure(
            UUID estateId, String code, String user, SetSilentFailureRequest request) {
        var category = changeable(estateId, code, user);
        var latest = repository.latestChange(estateId, code).orElse(null);
        var current = latest == null ? FLAGGED_BY_DEFAULT.equals(code) : latest.getFailssilently();
        if (current != request.failsSilently()) {
            var name = workOS.findDisplayName(user).orElse(null);
            latest = repository.record(estateId, code, request.failsSilently(), user, name);
        }
        var interval = intervals.latestCategoryChange(estateId, code).orElse(null);
        var count = repository.activeAssetCounts(estateId).getOrDefault(code, 0);
        return response(code, category.getLabel(), latest, interval, count);
    }

    /** Records a change only when the interval (value and unit) actually changes; null clears it. */
    @Transactional
    public EstateAssetCategoryResponse setServiceInterval(
            UUID estateId, String code, String user, SetServiceIntervalRequest request) {
        var interval = ServiceInterval.checked(request);
        var category = changeable(estateId, code, user);
        var latest = intervals.latestCategoryChange(estateId, code).orElse(null);
        var current = latest == null ? null : ServiceInterval.of(latest.getIntervalvalue(), latest.getIntervalunit());
        if (!Objects.equals(current, interval)) {
            var name = workOS.findDisplayName(user).orElse(null);
            latest = intervals.recordCategory(estateId, code, interval, user, name);
        }
        var flag = repository.latestChange(estateId, code).orElse(null);
        var count = repository.activeAssetCounts(estateId).getOrDefault(code, 0);
        return response(code, category.getLabel(), flag, latest, count);
    }

    private AssetcategoryRecord changeable(UUID estateId, String code, String user) {
        var estate = managed(estateId, user);
        if (estate.deactivatedAt() != null) {
            throw new AssetCategoryException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its asset categories cannot be changed.");
        }
        return repository
                .category(code)
                .orElseThrow(() -> new AssetCategoryException(HttpStatus.NOT_FOUND, "Asset category not found."));
    }

    private EstateResponse managed(UUID estateId, String user) {
        return estates.findManaged(estateId, user)
                .orElseThrow(() -> new AssetCategoryException(HttpStatus.NOT_FOUND, "Estate not found."));
    }

    private static EstateAssetCategoryResponse response(
            String code,
            String label,
            AssetcategoryflagchangeRecord flag,
            AssetcategoryintervalchangeRecord interval,
            int activeAssetCount) {
        var current =
                interval == null ? null : ServiceInterval.of(interval.getIntervalvalue(), interval.getIntervalunit());
        var intervalChange = interval == null
                ? null
                : new IntervalChangeResponse(
                        current, interval.getChangedbyuserid(), interval.getChangedbyname(), interval.getChangedat());
        if (flag == null) {
            return new EstateAssetCategoryResponse(
                    code,
                    label,
                    FLAGGED_BY_DEFAULT.equals(code),
                    true,
                    activeAssetCount,
                    null,
                    current,
                    intervalChange);
        }
        var change = new FlagChangeResponse(
                flag.getFailssilently(), flag.getChangedbyuserid(), flag.getChangedbyname(), flag.getChangedat());
        return new EstateAssetCategoryResponse(
                code, label, flag.getFailssilently(), false, activeAssetCount, change, current, intervalChange);
    }
}
