package com.proj.server.notification;

import org.springframework.http.HttpStatus;

class NotificationException extends RuntimeException {
    private final HttpStatus status;

    NotificationException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
