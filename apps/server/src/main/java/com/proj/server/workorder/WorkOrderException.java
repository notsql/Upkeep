package com.proj.server.workorder;

import org.springframework.http.HttpStatus;

class WorkOrderException extends RuntimeException {
    private final HttpStatus status;

    WorkOrderException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
