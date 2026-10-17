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
    @ApiResponse(responseCode = "401", description = "Sign in required", content = @Content),
    @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content),
    @ApiResponse(
            responseCode = "404",
            description = "Estate not found",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateUserController {
    private final EstateUserService service;

    public EstateUserController(EstateUserService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "Every estate and whether the user is assigned to it")
    @Operation(summary = "List every estate and whether the user is assigned to it")
    public List<EstateUserResponse> listUserEstates(@PathVariable String userId) {
        return service.list(userId);
    }

    @PutMapping("/{estateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "User added")
    @ApiResponse(
            responseCode = "409",
            description = "Resident membership requires explicit conversion",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @Operation(summary = "Add a user to an estate")
    public void addEstateUser(@PathVariable String userId, @PathVariable UUID estateId) {
        service.add(userId, estateId);
    }

    @DeleteMapping("/{estateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "User removed")
    @ApiResponse(
            responseCode = "409",
            description = "Resident membership cannot be removed through management grants",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @Operation(summary = "Remove a user from an estate")
    public void removeEstateUser(@PathVariable String userId, @PathVariable UUID estateId) {
        service.remove(userId, estateId);
    }
}
