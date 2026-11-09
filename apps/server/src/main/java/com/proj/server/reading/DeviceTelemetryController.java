package com.proj.server.reading;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A batch of readings from a device, with {@code Authorization: Bearer upk_...}.
 * Taken raw, like {@link DeviceReadingController}, so each item is read as
 * strictly as a single reading.
 */
@RestController
@RequestMapping("/device-api/telemetry")
public class DeviceTelemetryController {
    private final ReadingService service;

    public DeviceTelemetryController(ReadingService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(operationId = "submitTelemetry")
    @ApiResponse(
            responseCode = "200",
            description = "Each item decided on its own; one result per item, in request order",
            content = @Content(schema = @Schema(implementation = TelemetryBatchResponse.class)))
    @ApiResponse(
            responseCode = "400",
            description = "Not an object with only readings, an array of 1 to 500 items; nothing stored",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "401",
            description = "Missing, malformed, unknown or replaced device key",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "409",
            description = "The estate is inactive; nothing stored",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            required = true,
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = TelemetryBatchRequest.class)))
    public TelemetryBatchResponse submit(
            @AuthenticationPrincipal UUID deviceId, @RequestBody(required = false) byte[] body) {
        return service.submitBatch(deviceId, body);
    }
}
