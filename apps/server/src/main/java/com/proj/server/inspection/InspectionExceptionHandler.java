package com.proj.server.inspection;

import com.proj.server.estate.EstateError;
import com.proj.server.resident.ResidentReportException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice(assignableTypes = InspectionController.class)
public class InspectionExceptionHandler {
    @ExceptionHandler(InspectionException.class)
    ResponseEntity<EstateError> domain(InspectionException error) {
        return ResponseEntity.status(error.status())
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(ResidentReportException.class)
    ResponseEntity<EstateError> image(ResidentReportException error) {
        return ResponseEntity.status(error.status())
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler({
        org.springframework.web.bind.MethodArgumentNotValidException.class,
        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class,
        org.springframework.web.multipart.support.MissingServletRequestPartException.class
    })
    ResponseEntity<EstateError> invalid() {
        return ResponseEntity.badRequest()
                .header("Cache-Control", "private, no-store")
                .body(new EstateError("Check the inspection fields and try again."));
    }

    @ExceptionHandler({org.jooq.exception.DataAccessException.class, org.springframework.dao.DataAccessException.class})
    ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.status(503)
                .header("Cache-Control", "private, no-store")
                .body(new EstateError(
                        "Inspection storage is temporarily unavailable. Refresh history before retrying."));
    }
}
