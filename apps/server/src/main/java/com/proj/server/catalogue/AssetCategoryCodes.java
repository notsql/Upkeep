package com.proj.server.catalogue;

import java.util.Set;

/**
 * The asset category codes the server branches on. Every code here must have a seeded
 * {@code AssetCategory} row; a test checks this.
 */
public final class AssetCategoryCodes {
    public static final String PUMP = "PUMP";

    /** Every code above. Add new constants here too. */
    public static final Set<String> KEYED = Set.of(PUMP);

    private AssetCategoryCodes() {}
}
