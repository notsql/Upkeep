package com.proj.server.flatline;

import com.proj.server.estate.EstateError;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = FlatlineController.class)
public class FlatlineExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<EstateError> status(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode())
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(error.getReason()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return failure(HttpStatus.BAD_REQUEST, field.getField() + ": " + field.getDefaultMessage());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalid() {
        return failure(HttpStatus.BAD_REQUEST, "Invalid device metric request.");
    }

    @ExceptionHandler({DataAccessException.class, org.jooq.exception.DataAccessException.class})
    ResponseEntity<EstateError> unavailable() {
        return failure(HttpStatus.SERVICE_UNAVAILABLE, "Device readings are temporarily unavailable. Try again.");
    }

    private static ResponseEntity<EstateError> failure(HttpStatus status, String message) {
        return ResponseEntity.status(status)
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(message));
    }
}
