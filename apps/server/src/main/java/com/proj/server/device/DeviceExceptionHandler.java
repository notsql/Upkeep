package com.proj.server.device;

import com.proj.server.estate.EstateError;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = {DeviceController.class, EstateDeviceController.class})
public class DeviceExceptionHandler {
    @ExceptionHandler(DeviceException.class)
    ResponseEntity<EstateError> device(DeviceException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    // Two registrations raced past the service's identifier check; the unique index
    // caught the second. Never leak the SQL.
    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<EstateError> duplicate() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new EstateError("A device with this identifier is already registered."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<EstateError> integrity() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new EstateError("That device conflicts with another record. Reload and try again."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(new EstateError(field.getField() + ": " + field.getDefaultMessage()));
    }

    // Also where an unknown metric lands: Jackson cannot map it to the catalogue enum.
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest()
                .body(new EstateError("Invalid device request. Metrics must come from the supported list."));
    }
}
