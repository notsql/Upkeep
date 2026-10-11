package com.proj.server.catalogue;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Shared by all estates and holds no estate data, so any signed-in user can read it. */
@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class CatalogueController {
    private final CatalogueService service;

    public CatalogueController(CatalogueService service) {
        this.service = service;
    }

    @GetMapping("/asset-categories")
    @Operation(operationId = "listAssetCategories")
    @ApiResponse(responseCode = "200", description = "Every asset category, ordered by label")
    public List<AssetCategoryResponse> categories() {
        return service.categories();
    }

    @GetMapping("/manufacturers")
    @Operation(operationId = "listManufacturers")
    @ApiResponse(responseCode = "200", description = "Manufacturers whose names contain the query, at most 20")
    public List<ManufacturerResponse> manufacturers(@RequestParam(required = false) String query) {
        return service.manufacturers(query);
    }

    @GetMapping("/manufacturers/{manufacturerId}/models")
    @Operation(operationId = "listAssetModels")
    @ApiResponse(responseCode = "200", description = "The manufacturer's models in the category, at most 20")
    @ApiResponse(
            responseCode = "400",
            description = "Missing or unknown category",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "404",
            description = "Manufacturer not found",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    public List<AssetModelResponse> models(
            @PathVariable UUID manufacturerId,
            @RequestParam String category,
            @RequestParam(required = false) String query) {
        return service.models(manufacturerId, category, query);
    }
}
