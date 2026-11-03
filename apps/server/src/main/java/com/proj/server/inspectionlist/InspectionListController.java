package com.proj.server.inspectionlist;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** The estate's monthly inspection list with overdue checks (ID-84, ID-86). */
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
            description = "Estate not found or not managed by the caller",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class InspectionListController {
    private final InspectionListService service;

    public InspectionListController(InspectionListService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/inspection-list")
    @ApiResponse(responseCode = "200", description = "This month's checks, overdue checks and unscheduled assets")
    @Operation(operationId = "getInspectionList")
    public InspectionListResponse list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.list(estateId, user(jwt));
    }

    @PostMapping("/estates/{estateId}/inspection-list/generate")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Checks added (possibly none) and the list after generating"),
        @ApiResponse(
                responseCode = "409",
                description = "Inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    @Operation(operationId = "generateInspectionList")
    public GenerateInspectionListResponse generate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.generate(estateId, user(jwt));
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new InspectionListException(HttpStatus.UNAUTHORIZED, "Sign in to manage the inspection list.");
        }
        return jwt.getSubject();
    }
}
