package com.proj.server.routing;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The estate's contractor directory and its default contractor per equipment type. */
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
            description = "Owner or Manager required to change the directory",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Inaccessible estate or contractor",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate, duplicate email, or the contractor still has open jobs",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class ContractorController {
    private final ContractorDirectoryService directory;

    public ContractorController(ContractorDirectoryService directory) {
        this.directory = directory;
    }

    @GetMapping
    @Operation(
            operationId = "listContractors",
            summary = "The estate's contractors, by name, as owner, Manager or Crew")
    @ApiResponse(responseCode = "200", description = "The directory")
    public ResponseEntity<ContractorDirectoryResponse> list(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId) {
        return RoutingController.privateResponse(directory.list(estateId, RoutingController.subject(principal)));
    }

    @PostMapping
    @Operation(operationId = "addContractor", summary = "Add a contractor to the directory")
    @ApiResponse(responseCode = "201", description = "The new contractor")
    public ResponseEntity<ContractorResponse> add(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @Valid @RequestBody ContractorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .header("Cache-Control", "private, no-store")
                .body(directory.add(estateId, RoutingController.subject(principal), request));
    }

    @PutMapping("/{contractorId}")
    @Operation(operationId = "editContractor", summary = "Change a contractor's name or email")
    @ApiResponse(responseCode = "200", description = "The saved contractor")
    public ResponseEntity<ContractorResponse> edit(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID contractorId,
            @Valid @RequestBody ContractorRequest request) {
        return RoutingController.privateResponse(
                directory.edit(estateId, RoutingController.subject(principal), contractorId, request));
    }

    @DeleteMapping("/{contractorId}")
    @Operation(
            operationId = "removeContractor",
            summary = "Remove a contractor with no open jobs; its equipment defaults are cleared")
    @ApiResponse(responseCode = "204", description = "Removed")
    public ResponseEntity<Void> remove(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID contractorId) {
        directory.remove(estateId, RoutingController.subject(principal), contractorId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/defaults/{equipmentType}")
    @Operation(
            operationId = "setDefaultContractor",
            summary = "Send new water-leak reports for one equipment type to this contractor")
    @ApiResponse(responseCode = "200", description = "The contractor, with its updated defaults")
    public ResponseEntity<ContractorResponse> setDefault(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable EquipmentType equipmentType,
            @Valid @RequestBody ContractorDefaultRequest request) {
        return RoutingController.privateResponse(directory.setDefault(
                estateId, RoutingController.subject(principal), equipmentType, request.contractorId()));
    }

    @DeleteMapping("/defaults/{equipmentType}")
    @Operation(operationId = "clearDefaultContractor", summary = "Stop sending one equipment type to a contractor")
    @ApiResponse(responseCode = "204", description = "Cleared, or there was none")
    public ResponseEntity<Void> clearDefault(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable EquipmentType equipmentType) {
        directory.clearDefault(estateId, RoutingController.subject(principal), equipmentType);
        return ResponseEntity.noContent().build();
    }
}
