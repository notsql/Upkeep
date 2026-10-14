package com.proj.server.catalogue;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = CatalogueController.class)
public class CatalogueExceptionHandler {
    @ExceptionHandler(CatalogueException.class)
    ResponseEntity<EstateError> catalogue(CatalogueException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest().body(new EstateError("Invalid catalogue request."));
    }
}
