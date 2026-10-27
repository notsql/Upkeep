package com.proj.server.routing;

import com.proj.server.estate.EstateError;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.workorder.WorkOrderException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = {EquipmentContractorController.class, RoutingController.class})
public class RoutingExceptionHandler {
    @ExceptionHandler(ResidentReportException.class)
    ResponseEntity<EstateError> routing(ResidentReportException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler(WorkOrderException.class)
    ResponseEntity<EstateError> workOrder(WorkOrderException error) {
        return ResponseEntity.status(error.status()).body(new EstateError(error.getMessage()));
    }

    @ExceptionHandler({
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class
    })
    ResponseEntity<EstateError> invalidRequest() {
        return ResponseEntity.badRequest().body(new EstateError("Invalid request."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<EstateError> invalidBody() {
        return ResponseEntity.badRequest().body(new EstateError("Check the contractor and work-order details."));
    }
}
