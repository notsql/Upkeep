package com.proj.server.event;

import org.springframework.http.HttpStatus;

class AssetEventException extends RuntimeException {
    private final HttpStatus status;

    AssetEventException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
