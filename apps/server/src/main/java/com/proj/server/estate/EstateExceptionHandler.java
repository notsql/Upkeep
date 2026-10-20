package com.proj.server.estate;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = {EstateController.class, EstateUserController.class, CouncilController.class})
public class EstateExceptionHandler {
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new EstateError("Estate access is temporarily unavailable."));
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    ResponseEntity<EstateError> responseStatus(org.springframework.web.server.ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new EstateError(error.getReason()));
    }

    @ExceptionHandler(EstateException.class)
    ResponseEntity<EstateError> estate(EstateException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<EstateError> duplicate() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new EstateError("An estate with this code already exists."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(new EstateError(field.getField() + ": " + field.getDefaultMessage()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest().body(new EstateError("Invalid estate request."));
    }
}
