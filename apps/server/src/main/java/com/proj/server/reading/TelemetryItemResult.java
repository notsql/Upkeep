package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.http.HttpStatus;

/** One item's outcome. Only the fields for its status are present. */
@Schema(requiredProperties = {"index", "status"})
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TelemetryItemResult(
        @Schema(description = "The item's position in the request, from 0", format = "int32")
        int index,

        TelemetryItemStatus status,

        @Schema(description = "CREATED and ALREADY_STORED only: the stored reading")
        ReadingResponse reading,

        @Schema(description = "INVALID and CONFLICT only: why the item was not stored")
        String message) {

    static TelemetryItemResult stored(int index, ReadingService.Submitted submitted) {
        var status = submitted.created() ? TelemetryItemStatus.CREATED : TelemetryItemStatus.ALREADY_STORED;
        return new TelemetryItemResult(index, status, submitted.reading(), null);
    }

    static TelemetryItemResult rejected(int index, ReadingException rejected) {
        var status =
                rejected.status() == HttpStatus.CONFLICT ? TelemetryItemStatus.CONFLICT : TelemetryItemStatus.INVALID;
        return new TelemetryItemResult(index, status, null, rejected.getMessage());
    }
}
