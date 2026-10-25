package com.proj.server.reading;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Called by devices, not the web app, with {@code Authorization: Bearer upk_...}.
 * The body is taken raw so {@link ReadingValidator} can reject what Jackson
 * binding would quietly accept: unknown fields and numbers sent as strings.
 */
@RestController
@RequestMapping("/device-api/readings")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Malformed reading; the message names the field and the problem",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Missing, malformed, unknown or replaced device key",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "A different value is already stored for this metric and time, or the estate is inactive",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class DeviceReadingController {
    private final ReadingService service;

    public DeviceReadingController(ReadingService service) {
        this.service = service;
    }

    @PostMapping
    @ApiResponse(
            responseCode = "201",
            description = "Reading stored",
            content = @Content(schema = @Schema(implementation = ReadingResponse.class)))
    @ApiResponse(
            responseCode = "200",
            description = "An identical reading was already stored; nothing changed and it is returned",
            content = @Content(schema = @Schema(implementation = ReadingResponse.class)))
    @Operation(operationId = "submitReading")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
            required = true,
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = CreateReadingRequest.class)))
    public ResponseEntity<ReadingResponse> submit(
            @AuthenticationPrincipal UUID deviceId, @RequestBody(required = false) byte[] body) {
        var submitted = service.submit(deviceId, body);
        return ResponseEntity.status(submitted.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(submitted.reading());
    }
}
