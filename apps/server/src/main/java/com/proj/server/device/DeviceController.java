package com.proj.server.device;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estates/{estateId}/assets/{assetId}/devices")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Missing or invalid details, or an unsupported metric",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate, asset or location not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Duplicate identifier, or an inactive estate, asset or location",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class DeviceController {
    private final DeviceService service;

    public DeviceController(DeviceService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "The asset's devices, newest first")
    @Operation(operationId = "listDevices")
    public List<DeviceResponse> list(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return service.list(estateId, assetId, owner(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @ApiResponse(responseCode = "201", description = "Device registered, awaiting its first reading")
    @Operation(operationId = "registerDevice")
    public DeviceResponse register(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Valid @RequestBody CreateDeviceRequest request) {
        return service.register(estateId, assetId, owner(jwt), request);
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new DeviceException(HttpStatus.UNAUTHORIZED, "Sign in to manage devices.");
        }
        return jwt.getSubject();
    }
}
