package com.proj.server.category;

import com.proj.server.db.tables.records.AssetcategoryflagchangeRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.workos.WorkOSService;
import java.util.Comparator;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * An estate's silent-failure flag per asset category (ID-83). The owner and assigned Managers
 * read and change them; until changed, only LIGHTING is flagged.
 */
@Service
public class AssetCategorySettingsService {
    static final String FLAGGED_BY_DEFAULT = "LIGHTING";

    private final AssetCategorySettingsRepository repository;
    private final EstateRepository estates;
    private final WorkOSService workOS;

    public AssetCategorySettingsService(
            AssetCategorySettingsRepository repository, EstateRepository estates, WorkOSService workOS) {
        this.repository = repository;
        this.estates = estates;
        this.workOS = workOS;
    }

    public EstateAssetCategoriesResponse list(UUID estateId, String user) {
        var estate = managed(estateId, user);
        var changes = repository.latestChanges(estateId);
        var counts = repository.activeAssetCounts(estateId);
        var categories = repository.categories().stream()
                .map(category -> response(
                        category.getCode(),
                        category.getLabel(),
                        changes.get(category.getCode()),
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
        var estate = managed(estateId, user);
        if (estate.deactivatedAt() != null) {
            throw new AssetCategoryException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its asset categories cannot be changed.");
        }
        var category = repository
                .category(code)
                .orElseThrow(() -> new AssetCategoryException(HttpStatus.NOT_FOUND, "Asset category not found."));
        var latest = repository.latestChange(estateId, code).orElse(null);
        var current = latest == null ? FLAGGED_BY_DEFAULT.equals(code) : latest.getFailssilently();
        if (current != request.failsSilently()) {
            var name = workOS.findDisplayName(user).orElse(null);
            latest = repository.record(estateId, code, request.failsSilently(), user, name);
        }
        var count = repository.activeAssetCounts(estateId).getOrDefault(code, 0);
        return response(code, category.getLabel(), latest, count);
    }

    private EstateResponse managed(UUID estateId, String user) {
        return estates.findManaged(estateId, user)
                .orElseThrow(() -> new AssetCategoryException(HttpStatus.NOT_FOUND, "Estate not found."));
    }

    private static EstateAssetCategoryResponse response(
            String code, String label, AssetcategoryflagchangeRecord latest, int activeAssetCount) {
        if (latest == null) {
            return new EstateAssetCategoryResponse(
                    code, label, FLAGGED_BY_DEFAULT.equals(code), true, activeAssetCount, null);
        }
        var change = new FlagChangeResponse(
                latest.getFailssilently(),
                latest.getChangedbyuserid(),
                latest.getChangedbyname(),
                latest.getChangedat());
        return new EstateAssetCategoryResponse(code, label, latest.getFailssilently(), false, activeAssetCount, change);
    }
}
