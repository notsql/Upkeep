package com.proj.server.event;

/** A fixed server-side catalogue (decision 0016). Each type belongs to exactly one category. */
public enum AssetEventType {
    /** The asset failed and was repaired: the "Repaired" button. */
    BREAKDOWN_REPAIR(AssetEventCategory.MAINTENANCE),
    /** Serviced while still working. */
    PREVENTIVE(AssetEventCategory.MAINTENANCE);

    private final AssetEventCategory category;

    AssetEventType(AssetEventCategory category) {
        this.category = category;
    }

    public AssetEventCategory category() {
        return category;
    }
}
