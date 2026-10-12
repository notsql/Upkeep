package com.proj.server.admin;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = AdminController.class)
public class AdminExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<AdminError> responseStatus(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new AdminError(error.getReason()));
    }
}
