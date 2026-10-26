package com.proj.server.device;

import jakarta.validation.constraints.NotNull;

/** The device's identifier, typed exactly to confirm (ID-45). */
public record DeactivateDeviceRequest(@NotNull String identifier) {}
