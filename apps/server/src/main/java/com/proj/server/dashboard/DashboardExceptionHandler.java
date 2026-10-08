package com.proj.server.dashboard;

import com.proj.server.estate.EstateError;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = DashboardController.class)
public class DashboardExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<EstateError> identity(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new EstateError(error.getReason()));
    }

    @ExceptionHandler({DataAccessException.class, org.jooq.exception.DataAccessException.class})
    ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new EstateError("Dashboard summary is temporarily unavailable. Please try again."));
    }
}
