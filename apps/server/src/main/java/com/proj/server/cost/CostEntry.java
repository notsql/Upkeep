package com.proj.server.cost;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * One manual maintenance entry or completed work order with its cost parts; a null part is unknown.
 *
 * @param repair true for a breakdown repair (a BREAKDOWN_REPAIR entry or a completed work order), false for a
 *     preventive service
 * @param preventive true for a PREVENTIVE entry
 */
record CostEntry(UUID assetId, String category, boolean preventive, boolean repair, List<BigDecimal> parts) {
    /** The sum of the known parts; zero when none is known. */
    BigDecimal known() {
        return parts.stream().filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    boolean anyKnown() {
        return parts.stream().anyMatch(Objects::nonNull);
    }

    boolean anyUnknown() {
        return parts.stream().anyMatch(Objects::isNull);
    }
}
