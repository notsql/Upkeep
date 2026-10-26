package com.proj.server.inspection;

import org.springframework.http.HttpStatus;

public class InspectionException extends RuntimeException {
    private final HttpStatus status;

    public InspectionException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
