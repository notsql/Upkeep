package com.proj.server.category;

import com.proj.server.asset.AssetRepository;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.AssetintervalchangeRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.workos.WorkOSService;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * An asset's service-interval override and its effective interval (ID-81). The owner and
 * assigned Managers read and change overrides; the category interval is in {@link
 * AssetCategorySettingsService}.
 */
@Service
public class ServiceIntervalService {
    private final ServiceIntervalRepository repository;
    private final AssetCategorySettingsRepository categories;
    private final AssetRepository assets;
    private final EstateRepository estates;
    private final WorkOSService workOS;

    public ServiceIntervalService(
            ServiceIntervalRepository repository,
            AssetCategorySettingsRepository categories,
            AssetRepository assets,
            EstateRepository estates,
            WorkOSService workOS) {
        this.repository = repository;
        this.categories = categories;
        this.assets = assets;
        this.estates = estates;
        this.workOS = workOS;
    }

    /** The asset's override, else its category's interval in the estate, else none. No access check. */
    public EffectiveInterval effective(UUID estateId, UUID assetId) {
        var asset = assets.find(assetId, estateId, false).orElseThrow(ServiceIntervalService::assetNotFound);
        return effective(
                interval(repository.latestAssetChange(assetId).orElse(null)),
                categoryInterval(estateId, asset.getCategory()));
    }

    public AssetServiceIntervalResponse get(UUID estateId, UUID assetId, String user) {
        managed(estateId, user);
        var asset = assets.find(assetId, estateId, false).orElseThrow(ServiceIntervalService::assetNotFound);
        return response(estateId, asset, repository.latestAssetChange(assetId).orElse(null));
    }

    /** Records a change only when the override actually changes, so the history holds real changes. */
    @Transactional
    public AssetServiceIntervalResponse setOverride(
            UUID estateId, UUID assetId, String user, SetServiceIntervalRequest request) {
        var interval = ServiceInterval.checked(request);
        var estate = managed(estateId, user);
        if (estate.deactivatedAt() != null) {
            throw new AssetCategoryException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its service intervals cannot be changed.");
        }
        var asset = assets.find(assetId, estateId, false).orElseThrow(ServiceIntervalService::assetNotFound);
        if (asset.getDeactivatedat() != null || asset.getRetiredon() != null) {
            throw new AssetCategoryException(
                    HttpStatus.CONFLICT, "This asset is retired. Its service interval cannot be changed.");
        }
        var latest = repository.latestAssetChange(assetId).orElse(null);
        if (!Objects.equals(interval(latest), interval)) {
            var name = workOS.findDisplayName(user).orElse(null);
            latest = repository.recordAsset(assetId, interval, user, name);
        }
        return response(estateId, asset, latest);
    }

    private AssetServiceIntervalResponse response(UUID estateId, AssetRecord asset, AssetintervalchangeRecord latest) {
        var override = interval(latest);
        var categoryInterval = categoryInterval(estateId, asset.getCategory());
        var effective = effective(override, categoryInterval);
        var label = categories
                .category(asset.getCategory())
                .map(category -> category.getLabel())
                .orElse(asset.getCategory());
        var change = latest == null
                ? null
                : new IntervalChangeResponse(
                        override, latest.getChangedbyuserid(), latest.getChangedbyname(), latest.getChangedat());
        return new AssetServiceIntervalResponse(
                effective.interval(), effective.source(), override, categoryInterval, label, change);
    }

    private static EffectiveInterval effective(ServiceInterval override, ServiceInterval categoryInterval) {
        if (override != null) {
            return new EffectiveInterval(override, IntervalSource.ASSET);
        }
        if (categoryInterval != null) {
            return new EffectiveInterval(categoryInterval, IntervalSource.CATEGORY);
        }
        return new EffectiveInterval(null, IntervalSource.NONE);
    }

    private static ServiceInterval interval(AssetintervalchangeRecord change) {
        return change == null ? null : ServiceInterval.of(change.getIntervalvalue(), change.getIntervalunit());
    }

    private ServiceInterval categoryInterval(UUID estateId, String category) {
        return repository
                .latestCategoryChange(estateId, category)
                .map(change -> ServiceInterval.of(change.getIntervalvalue(), change.getIntervalunit()))
                .orElse(null);
    }

    private EstateResponse managed(UUID estateId, String user) {
        return estates.findManaged(estateId, user)
                .orElseThrow(() -> new AssetCategoryException(HttpStatus.NOT_FOUND, "Estate not found."));
    }

    private static AssetCategoryException assetNotFound() {
        return new AssetCategoryException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
