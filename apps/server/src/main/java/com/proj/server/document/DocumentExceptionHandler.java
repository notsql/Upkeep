package com.proj.server.document;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = DocumentController.class)
public class DocumentExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<EstateError> status(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode())
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(error.getReason()));
    }

    @ExceptionHandler({BindException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalid() {
        return ResponseEntity.badRequest()
                .body(new EstateError("Choose one file and a valid document type, search, cursor or page size."));
    }

    @ExceptionHandler({org.jooq.exception.DataAccessException.class, org.springframework.dao.DataAccessException.class})
    ResponseEntity<EstateError> database() {
        return ResponseEntity.internalServerError()
                .body(new EstateError("The document operation could not be completed. Try again."));
    }
}
