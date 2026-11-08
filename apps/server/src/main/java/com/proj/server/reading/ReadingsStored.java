package com.proj.server.reading;

import java.util.UUID;

/** Published when a device request stored at least one new reading for the asset. */
public record ReadingsStored(UUID assetId) {}
