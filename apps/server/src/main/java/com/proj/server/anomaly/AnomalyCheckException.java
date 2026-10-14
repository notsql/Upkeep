package com.proj.server.anomaly;

import org.springframework.http.HttpStatus;

class AnomalyCheckException extends RuntimeException {
    private final HttpStatus status;

    AnomalyCheckException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
