package com.proj.server.category;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AssetCategorySettingsController.class)
public class AssetCategoryExceptionHandler {
    @ExceptionHandler(AssetCategoryException.class)
    ResponseEntity<EstateError> category(AssetCategoryException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(new EstateError(field.getField() + ": " + field.getDefaultMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<EstateError> unreadable() {
        return ResponseEntity.badRequest().body(new EstateError("failsSilently: must be true or false."));
    }

    /** Permission refusals from EstatePermissions.require keep the EstateError body (estate-role-permissions). */
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    ResponseEntity<EstateError> responseStatus(org.springframework.web.server.ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new EstateError(error.getReason()));
    }
}
