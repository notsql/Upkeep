package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

/** Who has a work order: a team member or a contractor from the estate's directory. */
@Schema(requiredProperties = {"kind", "id", "name", "email", "assignedAt", "inEstate"})
public record WorkOrderAssigneeResponse(
        WorkOrderAssignment.Kind kind,

        @Schema(
                nullable = true,
                description = "The member's user ID or the contractor's ID; null for a contractor since removed"
                        + " from the directory (closed orders only)")
        String id,

        @Schema(description = "The name saved when the job was given")
        String name,

        @Schema(nullable = true, description = "The contractor's email; null for a member")
        String email,

        OffsetDateTime assignedAt,

        @Schema(description = "False when a member assignee has since left the estate or lost their staff role")
        boolean inEstate) {}
