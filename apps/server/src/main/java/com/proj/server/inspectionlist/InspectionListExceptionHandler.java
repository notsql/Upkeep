package com.proj.server.inspectionlist;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = InspectionListController.class)
public class InspectionListExceptionHandler {
    @ExceptionHandler(InspectionListException.class)
    ResponseEntity<EstateError> list(InspectionListException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    /** Permission refusals from EstatePermissions.require keep the EstateError body (estate-role-permissions). */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    ResponseEntity<EstateError> responseStatus(org.springframework.web.server.ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new EstateError(error.getReason()));
    }
}
