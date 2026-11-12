package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

/** Who a work order can be given to: the estate's team, then its contractors, each by name. */
@Schema(requiredProperties = {"members", "contractors"})
public record AssigneeCandidatesResponse(List<Member> members, List<Contractor> contractors) {
    public enum Role {
        MANAGER,
        CREW
    }

    @Schema(
            name = "AssigneeCandidateMember",
            requiredProperties = {"userId", "name", "role"})
    public record Member(
            String userId,
            String name,

            @Schema(description = "Owners are listed as MANAGER")
            Role role) {}

    @Schema(
            name = "AssigneeCandidateContractor",
            requiredProperties = {"id", "name", "email"})
    public record Contractor(UUID id, String name, String email) {}
}
