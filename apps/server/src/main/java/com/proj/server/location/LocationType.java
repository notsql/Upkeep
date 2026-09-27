package com.proj.server.location;

import java.util.Set;

public enum LocationType {
    BLOCK,
    LEVEL,
    COMMON_AREA;

    /** The parent types this type may sit under. An empty set means it sits directly under the estate. */
    Set<LocationType> allowedParents() {
        return switch (this) {
            case BLOCK -> Set.of();
            case LEVEL -> Set.of(BLOCK);
            case COMMON_AREA -> Set.of(BLOCK, LEVEL);
        };
    }
}
