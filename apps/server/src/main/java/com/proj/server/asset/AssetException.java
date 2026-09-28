package com.proj.server.asset;

import org.springframework.http.HttpStatus;

class AssetException extends RuntimeException {
    private final HttpStatus status;

    AssetException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
