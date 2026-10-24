package com.proj.server.estate;

import java.util.UUID;

final class EstateRoleSelection {
    private EstateRoleSelection() {}

    static void validate(EstateRole role, UUID customRoleId, Integer expectedRoleVersion) {
        if (role == null) throw new IllegalArgumentException("Choose an estate role.");
        if (role == EstateRole.CUSTOM) {
            if (customRoleId == null || expectedRoleVersion == null || expectedRoleVersion < 1)
                throw new IllegalArgumentException("Choose a custom role and its current version.");
        } else if (customRoleId != null || expectedRoleVersion != null) {
            throw new IllegalArgumentException("Preset roles cannot reference a custom definition or version.");
        }
    }
}
