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
}
