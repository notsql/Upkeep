package com.proj.server.reading;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = DeviceReadingController.class)
public class ReadingExceptionHandler {
    @ExceptionHandler(ReadingException.class)
    ResponseEntity<EstateError> reading(ReadingException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }
}
