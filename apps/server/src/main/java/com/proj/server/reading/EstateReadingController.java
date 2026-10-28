package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.EnumSet;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request payload, filters or pagination",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Owner, Manager or Crew readings access required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or selected asset not found",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateReadingController {
    private final EstateReadingService service;

    private final ManualReadingService manual;

    public EstateReadingController(EstateReadingService service, ManualReadingService manual) {
        this.service = service;
        this.manual = manual;
    }

    @PostMapping("/estates/{estateId}/readings/manual")
    @Operation(operationId = "createManualReading", summary = "Record an attributed human measurement")
    @ApiResponse(
            responseCode = "201",
            description = "Manual reading recorded",
            content = @Content(schema = @Schema(implementation = ManualReadingResponse.class)))
    @ApiResponse(
            responseCode = "200",
            description = "Identical retry; original reading returned",
            content = @Content(schema = @Schema(implementation = ManualReadingResponse.class)))
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate, retired asset or conflicting submission",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    public ResponseEntity<ManualReadingResponse> createManual(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            required = true,
                            content = @Content(schema = @Schema(implementation = CreateManualReadingRequest.class)))
                    @RequestBody
                    byte[] body) {
        var submitted = manual.submit(estateId, user(jwt), body);
        return ResponseEntity.status(submitted.created() ? 201 : 200)
                .header("Cache-Control", "private, no-store")
                .body(submitted.reading());
    }

    @GetMapping("/estates/{estateId}/readings/metrics")
    @Operation(operationId = "listReadingMetrics")
    @ApiResponse(responseCode = "200", description = "Fixed metric catalogue with units and expected ranges")
    public List<ReadingMetricOption> metrics(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        service.authorize(estateId, user(jwt));
        return Arrays.stream(com.proj.server.device.DeviceMetric.values())
                .map(metric -> new ReadingMetricOption(metric, metric.unit(), metric.validMin(), metric.validMax()))
                .toList();
    }

    @GetMapping("/estates/{estateId}/readings")
    @Operation(operationId = "listEstateReadings")
    @ApiResponse(
            responseCode = "200",
            description = "Matching sensor and manual readings, newest first, with provenance and per-asset flags")
    public EstateReadingPage list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(required = false) UUID assetId,
            @RequestParam(required = false) DeviceMetric metric,
            @Parameter(description = "Inclusive") @RequestParam(required = false) OffsetDateTime from,
            @Parameter(description = "Exclusive") @RequestParam(required = false) OffsetDateTime to,
            @RequestParam(required = false) List<ReadingFlagType> flag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var flags = flag == null || flag.isEmpty() ? EnumSet.noneOf(ReadingFlagType.class) : EnumSet.copyOf(flag);
        return service.list(estateId, user(jwt), assetId, metric, from, to, flags, page, size);
    }

    @GetMapping("/estates/{estateId}/readings/assets")
    @Operation(operationId = "listReadingAssets")
    @ApiResponse(responseCode = "200", description = "Minimal same-estate asset labels, including retired assets")
    public ReadingAssetOptionPage assets(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return service.assets(estateId, user(jwt), search, page, size);
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new ReadingException(HttpStatus.UNAUTHORIZED, "Sign in to view readings.");
        }
        return jwt.getSubject();
    }
}
