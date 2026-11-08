package com.proj.server.cost;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = EstateCostController.class)
public class EstateCostExceptionHandler {
    @ExceptionHandler(EstateCostException.class)
    ResponseEntity<EstateError> cost(EstateCostException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }
}
