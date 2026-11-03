package com.proj.server.inspectionlist;

import org.springframework.http.HttpStatus;

class InspectionListException extends RuntimeException {
    private final HttpStatus status;

    InspectionListException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
