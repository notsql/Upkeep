package com.proj.server.reading;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = AssetReadingController.class)
public class AssetReadingExceptionHandler {
    @ExceptionHandler(ReadingException.class)
    ResponseEntity<EstateError> reading(ReadingException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    // An unknown metric, a malformed time or a non-numeric page or size.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<EstateError> mismatch(MethodArgumentTypeMismatchException error) {
        return ResponseEntity.badRequest()
                .body(new EstateError(error.getName() + ": \"" + error.getValue() + "\" is not a valid value."));
    }
}
