package com.proj.server.inspectionlist;

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
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @GetMapping("/estates/{estateId}/inspectors")
    @ApiResponse(responseCode = "200", description = "Members who can record inspections, sorted by name")
    @Operation(operationId = "listInspectors")
    public List<InspectorResponse> inspectors(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.inspectors(estateId, user(jwt));
    }

    @PostMapping("/estates/{estateId}/assets/{assetId}/inspection-requests")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Check opened and the person notified"),
        @ApiResponse(responseCode = "200", description = "The equipment's open check, which already existed"),
        @ApiResponse(
                responseCode = "400",
                description = "Person missing or unable to record inspections here",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Inactive estate, retired equipment, or already inspected this month",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    @Operation(operationId = "requestInspection", summary = "Send one person to inspect the equipment this month")
    public ResponseEntity<InspectionCheckResponse> request(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Valid @RequestBody InspectionRequest request) {
        var sent = service.request(estateId, assetId, user(jwt), request);
        return ResponseEntity.status(sent.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(sent.check());
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new InspectionListException(HttpStatus.UNAUTHORIZED, "Sign in to manage the inspection list.");
        }
        return jwt.getSubject();
    }
}
