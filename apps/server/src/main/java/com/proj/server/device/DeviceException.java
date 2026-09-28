package com.proj.server.device;

import org.springframework.http.HttpStatus;

class DeviceException extends RuntimeException {
    private final HttpStatus status;

    DeviceException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
