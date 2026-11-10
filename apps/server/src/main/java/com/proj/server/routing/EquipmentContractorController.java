package com.proj.server.routing;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/estates/{estateId}/contractors")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid UUID, equipment type, name or email",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Work-order creation authority required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Inaccessible estate",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EquipmentContractorController {
    private final ReportRoutingService routing;

    public EquipmentContractorController(ReportRoutingService routing) {
        this.routing = routing;
    }

    @GetMapping
    @Operation(
            operationId = "listEquipmentContractors",
            summary = "The estate's external contractor per equipment type")
    @ApiResponse(
            responseCode = "200",
            description = "Contractors in equipment-type order; types without one are absent")
    public ResponseEntity<List<EquipmentContractorResponse>> list(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId) {
        return RoutingController.privateResponse(routing.contractors(estateId, RoutingController.subject(principal)));
    }

    @PutMapping("/{equipmentType}")
    @Operation(
            operationId = "saveEquipmentContractor",
            summary = "Create or replace the contractor for one equipment type")
    @ApiResponse(responseCode = "200", description = "The saved contractor")
    public ResponseEntity<EquipmentContractorResponse> save(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable EquipmentType equipmentType,
            @Valid @RequestBody EquipmentContractorRequest request) {
        return RoutingController.privateResponse(
                routing.saveContractor(estateId, RoutingController.subject(principal), equipmentType, request));
    }

    @DeleteMapping("/{equipmentType}")
    @Operation(operationId = "removeEquipmentContractor", summary = "Remove the contractor for one equipment type")
    @ApiResponse(responseCode = "204", description = "Removed, or there was none")
    public ResponseEntity<Void> remove(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable EquipmentType equipmentType) {
        routing.removeContractor(estateId, RoutingController.subject(principal), equipmentType);
        return ResponseEntity.noContent().build();
    }
}
