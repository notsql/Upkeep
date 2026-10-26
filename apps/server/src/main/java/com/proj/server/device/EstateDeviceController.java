package com.proj.server.device;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Every device in an estate with its reporting status (ID-44). */
@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Resident membership does not grant management access",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate not found, or not managed by the caller",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateDeviceController {
    private final DeviceService service;

    public EstateDeviceController(DeviceService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/devices")
    @ApiResponse(
            responseCode = "200",
            description = "The estate's devices: Offline, then Awaiting first reading, then Online,"
                    + " the longest silent first")
    @Operation(operationId = "listEstateDevices")
    public List<EstateDeviceResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new DeviceException(HttpStatus.UNAUTHORIZED, "Sign in to manage devices.");
        }
        return service.listForEstate(estateId, jwt.getSubject());
    }
}
