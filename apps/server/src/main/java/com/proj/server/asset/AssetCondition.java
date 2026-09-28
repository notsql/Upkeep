package com.proj.server.asset;

/** Decision 0017. Worst last, so a future "at least" filter can compare ordinals. */
public enum AssetCondition {
    GOOD,
    NEEDS_ATTENTION,
    FAULTY
}
