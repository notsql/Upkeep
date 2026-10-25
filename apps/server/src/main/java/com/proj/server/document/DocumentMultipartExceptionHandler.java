package com.proj.server.document;

import com.proj.server.estate.EstateError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Multipart parsing may fail before a controller can be selected. */
@RestControllerAdvice
public class DocumentMultipartExceptionHandler {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<EstateError> oversized(HttpServletRequest request) {
        String message = request.getRequestURI().endsWith("/documents")
                ? "Choose exactly one file no larger than 5 MB."
                : "The upload is larger than 17 MB.";
        return ResponseEntity.status(413).body(new EstateError(message));
    }
}
