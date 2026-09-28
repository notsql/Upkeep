package com.proj.server.location;

import com.proj.server.estate.EstateError;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = LocationController.class)
public class LocationExceptionHandler {
    @ExceptionHandler(LocationException.class)
    ResponseEntity<EstateError> location(LocationException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    // The service checks every rule first; this only fires if the database's own
    // constraints catch something the checks missed. Never leak the SQL.
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<EstateError> integrity() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new EstateError("That change conflicts with the estate's location hierarchy."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(new EstateError(field.getField() + ": " + field.getDefaultMessage()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest().body(new EstateError("Invalid location request."));
    }
}
