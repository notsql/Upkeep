package com.proj.server.resident;

import org.springframework.http.HttpStatus;

public class ResidentReportException extends RuntimeException {
    private final HttpStatus status;

    public ResidentReportException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
