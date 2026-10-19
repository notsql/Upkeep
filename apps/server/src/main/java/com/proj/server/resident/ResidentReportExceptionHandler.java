package com.proj.server.resident;

import com.proj.server.estate.EstateError;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice(assignableTypes = ResidentReportController.class)
public class ResidentReportExceptionHandler {
    @ExceptionHandler(ResidentReportException.class)
    ResponseEntity<EstateError> report(ResidentReportException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest().body(new EstateError("Invalid report request."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> invalidBody() {
        return ResponseEntity.badRequest().body(new EstateError("Enter a description and choose a location."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<EstateError> oversized() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new EstateError("The upload is larger than 17 MB."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<EstateError> integrity() {
        return ResponseEntity.badRequest()
                .body(new EstateError("The assignment or location changed. Reload and try again."));
    }
}
