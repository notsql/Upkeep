package com.proj.server.notification;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = {NotificationController.class, NotificationSettingsController.class})
public class NotificationExceptionHandler {
    @ExceptionHandler(NotificationException.class)
    ResponseEntity<EstateError> notification(NotificationException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(new EstateError(field.getField() + ": " + field.getDefaultMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<EstateError> unreadable() {
        return ResponseEntity.badRequest()
                .body(new EstateError("The request body is not valid JSON for this request."));
    }
}
