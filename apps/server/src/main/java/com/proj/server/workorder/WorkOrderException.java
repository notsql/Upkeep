package com.proj.server.workorder;

import org.springframework.http.HttpStatus;

/** A work-order rule failure; public so ID-70's routing controllers can map it to its status. */
public class WorkOrderException extends RuntimeException {
    private final HttpStatus status;

    public WorkOrderException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
