package com.proj.server.cost;

import org.springframework.http.HttpStatus;

class EstateCostException extends RuntimeException {
    private final HttpStatus status;

    EstateCostException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
