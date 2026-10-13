package com.proj.server.risk;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = FailureRiskController.class)
public class FailureRiskExceptionHandler {
    @ExceptionHandler(FailureRiskException.class)
    ResponseEntity<EstateError> risk(FailureRiskException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest().body(new EstateError("Invalid failure-risk request."));
    }
}
