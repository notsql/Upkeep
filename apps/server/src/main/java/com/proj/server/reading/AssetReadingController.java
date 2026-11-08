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
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/estates/{estateId}/assets/{assetId}/readings")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Unknown metric or flag, a malformed time, from not before to, or page or size out of range",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
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
            description = "Estate or asset not found",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AssetReadingController {
    private final AssetReadingService service;
    private final ReadingSeriesService series;
    private final ReadingGroupService groups;

    public AssetReadingController(
            AssetReadingService service, ReadingSeriesService series, ReadingGroupService groups) {
        this.service = service;
        this.series = series;
        this.groups = groups;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "One page of the asset's readings, newest first")
    @Operation(operationId = "listAssetReadings")
    public AssetReadingPage list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @RequestParam(required = false) DeviceMetric metric,
            @Parameter(description = "Inclusive") @RequestParam(required = false) OffsetDateTime from,
            @Parameter(description = "Exclusive") @RequestParam(required = false) OffsetDateTime to,
            @Parameter(description = "Repeatable; lists readings carrying any of them") @RequestParam(required = false)
                    List<ReadingFlagType> flag,
            @Parameter(description = "Starts at 0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "1 to 200") @RequestParam(defaultValue = "50") int size) {
        return service.list(estateId, assetId, owner(jwt), metric, from, to, flags(flag), page, size);
    }

    @GetMapping("/series")
    @ApiResponse(responseCode = "200", description = "The asset's device readings bucketed for a chart")
    @Operation(
            operationId = "getAssetReadingSeries",
            description = "Readable by Owner, Manager and Crew. Buckets are the smallest of 1 s, 5 s, 10 s, 15 s, 30 s,"
                    + " 1 min, 2 min and 5 min giving at most 300 over the range. Manual readings are not included.")
    public ReadingSeriesResponse series(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Parameter(description = "Inclusive") @RequestParam OffsetDateTime from,
            @Parameter(description = "Exclusive; at most 24 hours after from") @RequestParam OffsetDateTime to,
            @Parameter(description = "Repeatable; omitted means every metric with readings in the range")
                    @RequestParam(required = false)
                    List<DeviceMetric> metric) {
        return series.series(estateId, assetId, owner(jwt), from, to, metric);
    }

    @GetMapping("/grouped")
    @ApiResponse(responseCode = "200", description = "The asset's latest readings grouped per instant and source")
    @Operation(
            operationId = "getAssetReadingGroups",
            description = "Readable by Owner, Manager and Crew. A group is the readings at one measuredAt from one"
                    + " device or one manual recorder. limit bounds timestamps, so a page can hold more groups.")
    public ReadingGroupPage grouped(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Parameter(description = "Timestamps per page, 1 to 100") @RequestParam(defaultValue = "20") int limit,
            @Parameter(description = "Exclusive; the previous page's nextBefore") @RequestParam(required = false)
                    OffsetDateTime before,
            @Parameter(description = "Inclusive") @RequestParam(required = false) OffsetDateTime from,
            @Parameter(description = "Exclusive") @RequestParam(required = false) OffsetDateTime to,
            @Parameter(description = "Repeatable; limits both the groups and their metrics")
                    @RequestParam(required = false)
                    List<DeviceMetric> metric,
            @Parameter(description = "Repeatable; a group matches when any of its readings carries any of these")
                    @RequestParam(required = false)
                    List<ReadingFlagType> flag) {
        return groups.groups(estateId, assetId, owner(jwt), limit, before, from, to, metrics(metric), flags(flag));
    }

    private static EnumSet<DeviceMetric> metrics(List<DeviceMetric> metric) {
        return metric == null || metric.isEmpty() ? EnumSet.allOf(DeviceMetric.class) : EnumSet.copyOf(metric);
    }

    private static EnumSet<ReadingFlagType> flags(List<ReadingFlagType> flag) {
        return flag == null || flag.isEmpty() ? EnumSet.noneOf(ReadingFlagType.class) : EnumSet.copyOf(flag);
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new ReadingException(HttpStatus.UNAUTHORIZED, "Sign in to view readings.");
        }
        return jwt.getSubject();
    }
}
