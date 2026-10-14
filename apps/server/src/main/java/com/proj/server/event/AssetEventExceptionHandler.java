package com.proj.server.event;

import com.proj.server.estate.EstateError;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = AssetEventController.class)
public class AssetEventExceptionHandler {
    @ExceptionHandler(AssetEventException.class)
    ResponseEntity<EstateError> event(AssetEventException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    // The service checks every rule first; never leak the SQL if a constraint still fires.
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<EstateError> integrity() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new EstateError("That event conflicts with the asset's current details. Reload and try again."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(new EstateError(field.getField() + ": " + field.getDefaultMessage()));
    }

    // Also where an unknown type lands: Jackson cannot map it to the enum.
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest()
                .body(new EstateError("Invalid event request. The type must be a supported one."));
    }
}
