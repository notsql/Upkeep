package com.proj.server.storage;

import com.proj.server.estate.EstateError;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** One answer for every feature that stores files; runs before the feature-scoped handlers. */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class StorageExceptionHandler {
    @ExceptionHandler(StorageUnavailableException.class)
    ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header("Cache-Control", "private, no-store")
                .body(new EstateError("File storage is temporarily unavailable. Try again later."));
    }
}
