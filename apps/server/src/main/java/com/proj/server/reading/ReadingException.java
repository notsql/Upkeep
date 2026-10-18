package com.proj.server.reading;

import org.springframework.http.HttpStatus;

class ReadingException extends RuntimeException {
    private final HttpStatus status;

    ReadingException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    HttpStatus status() {
        return status;
    }
}
