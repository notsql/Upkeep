package com.proj.server.category;

import org.springframework.http.HttpStatus;

class AssetCategoryException extends RuntimeException {
    private final HttpStatus status;

    AssetCategoryException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
