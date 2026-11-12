package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

/** A contractor in the estate's directory and the equipment types new water-leak reports go to it for. */
@Schema(requiredProperties = {"id", "name", "email", "defaultFor"})
public record ContractorResponse(UUID id, String name, String email, List<EquipmentType> defaultFor) {
    static ContractorResponse of(RoutingRepository.DirectoryEntry entry) {
        return new ContractorResponse(entry.id(), entry.name(), entry.email(), entry.defaultFor());
    }
}
