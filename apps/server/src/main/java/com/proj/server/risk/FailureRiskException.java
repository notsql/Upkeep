package com.proj.server.risk;

import org.springframework.http.HttpStatus;

class FailureRiskException extends RuntimeException {
    private final HttpStatus status;

    FailureRiskException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
