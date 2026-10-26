package com.proj.server.workorder;

import com.proj.server.estate.EstateError;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = WorkOrderController.class)
public class WorkOrderExceptionHandler {
    @ExceptionHandler(WorkOrderException.class)
    ResponseEntity<EstateError> domain(WorkOrderException error) {
        return ResponseEntity.status(error.status())
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class
    })
    ResponseEntity<EstateError> invalid() {
        return ResponseEntity.badRequest()
                .header("Cache-Control", "private, no-store")
                .body(new EstateError("Check the work-order fields and try again."));
    }
}
