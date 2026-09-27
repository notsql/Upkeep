package com.proj.server.estate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users/{userId}/estates")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(responseCode = "401", description = "Sign in required"),
    @ApiResponse(responseCode = "403", description = "Admin role required"),
    @ApiResponse(
            responseCode = "404",
            description = "Estate not found",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateAccessController {
    private final EstateAccessService service;

    public EstateAccessController(EstateAccessService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "Every estate with the user's access")
    @Operation(summary = "List every estate with a user's access")
    public List<EstateAccessResponse> listUserEstateAccess(@PathVariable String userId) {
        return service.list(userId);
    }

    @PutMapping("/{estateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "Access granted")
    @Operation(summary = "Grant a user access to an estate")
    public void grantEstateAccess(@PathVariable String userId, @PathVariable UUID estateId) {
        service.grant(userId, estateId);
    }

    @DeleteMapping("/{estateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "Access revoked")
    @Operation(summary = "Revoke a user's access to an estate")
    public void revokeEstateAccess(@PathVariable String userId, @PathVariable UUID estateId) {
        service.revoke(userId, estateId);
    }
}
