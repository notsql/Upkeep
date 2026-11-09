package com.proj.server.assethistory;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = AssetHistoryController.class)
public class AssetHistoryExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<EstateError> domain(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode())
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(error.getReason()));
    }

    @ExceptionHandler({
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class
    })
    ResponseEntity<EstateError> invalid() {
        return ResponseEntity.badRequest()
                .header("Cache-Control", "private, no-store")
                .body(new EstateError("Check the history filters, paths and page parameters."));
    }

    @ExceptionHandler({org.jooq.exception.DataAccessException.class, org.springframework.dao.DataAccessException.class})
    ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.internalServerError()
                .header("Cache-Control", "private, no-store")
                .body(new EstateError("Couldn't load the history. Try again."));
    }
}
