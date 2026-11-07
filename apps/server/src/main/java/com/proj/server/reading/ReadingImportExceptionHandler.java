package com.proj.server.reading;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = ReadingImportController.class)
public class ReadingImportExceptionHandler {
    @ExceptionHandler(ReadingException.class)
    ResponseEntity<EstateError> reading(ReadingException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<EstateError> access(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new EstateError(error.getReason()));
    }

    @ExceptionHandler({org.jooq.exception.DataAccessException.class, org.springframework.dao.DataAccessException.class})
    ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.status(503)
                .body(new EstateError(
                        "Reading import storage is temporarily unavailable. Retry with the same submission UUID."));
    }

    @ExceptionHandler({
        org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.http.converter.HttpMessageNotReadableException.class,
        org.springframework.web.multipart.support.MissingServletRequestPartException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class
    })
    ResponseEntity<EstateError> invalid() {
        return ResponseEntity.badRequest()
                .body(new EstateError("Choose a CSV file, valid mapping, source label and submission UUID."));
    }
}
