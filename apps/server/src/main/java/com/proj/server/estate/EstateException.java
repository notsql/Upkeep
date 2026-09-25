package com.proj.server.estate;

import org.springframework.http.HttpStatus;

class EstateException extends RuntimeException {
    private final HttpStatus status;

    EstateException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
