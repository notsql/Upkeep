package com.proj.server.routing;

/** Delivery of a work order email; separate from the work order's own status. */
public enum DispatchStatus {
    PENDING,
    SENT,
    FAILED
}
