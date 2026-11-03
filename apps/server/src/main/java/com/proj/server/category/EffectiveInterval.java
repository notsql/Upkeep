package com.proj.server.category;

/** An asset's service interval (null when none applies) and its source. */
public record EffectiveInterval(ServiceInterval interval, IntervalSource source) {}
