package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

@Schema(requiredProperties = {"groups"})
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReadingGroupPage(
        @Schema(description = "Newest first; every group at one measuredAt is on the same page")
        List<ReadingGroup> groups,

        @Schema(description = "Pass as before for the next page; absent when there are no older readings")
        OffsetDateTime nextBefore) {}
