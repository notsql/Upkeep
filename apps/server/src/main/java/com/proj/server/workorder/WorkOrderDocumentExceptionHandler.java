package com.proj.server.workorder;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = WorkOrderDocumentController.class)
public class WorkOrderDocumentExceptionHandler {
    @ExceptionHandler(WorkOrderException.class)
    ResponseEntity<EstateError> domain(WorkOrderException error) {
        return response(error.status().value(), error.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<EstateError> status(ResponseStatusException error) {
        return response(error.getStatusCode().value(), error.getReason());
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class
    })
    ResponseEntity<EstateError> invalid() {
        return response(400, "Check the document link, version, correction reason and pagination fields.");
    }

    @ExceptionHandler({org.jooq.exception.DataAccessException.class, org.springframework.dao.DataAccessException.class})
    ResponseEntity<EstateError> database() {
        return response(500, "The document association could not be saved or loaded. Refresh before retrying.");
    }

    private static ResponseEntity<EstateError> response(int status, String message) {
        return ResponseEntity.status(status)
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(message));
    }
}
