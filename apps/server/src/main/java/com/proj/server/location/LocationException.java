package com.proj.server.location;

import org.springframework.http.HttpStatus;

class LocationException extends RuntimeException {
    private final HttpStatus status;

    LocationException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
