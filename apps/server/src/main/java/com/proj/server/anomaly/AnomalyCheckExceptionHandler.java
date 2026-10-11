package com.proj.server.anomaly;

import com.proj.server.estate.EstateError;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = AnomalyCheckController.class)
public class AnomalyCheckExceptionHandler {
    @ExceptionHandler(AnomalyCheckException.class)
    ResponseEntity<EstateError> check(AnomalyCheckException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(MlUnavailableException.class)
    ResponseEntity<EstateError> mlUnavailable(MlUnavailableException error) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest()
                .body(new EstateError("Invalid readings. Each needs a timestamp and a finite value for every metric."));
    }
}
