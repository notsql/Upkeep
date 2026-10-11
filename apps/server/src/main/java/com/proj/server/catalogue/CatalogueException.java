package com.proj.server.catalogue;

import org.springframework.http.HttpStatus;

class CatalogueException extends RuntimeException {
    private final HttpStatus status;

    CatalogueException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
