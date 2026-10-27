package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(requiredProperties = {"equipmentType", "name", "email", "updatedAt"})
public record EquipmentContractorResponse(
        EquipmentType equipmentType, String name, String email, OffsetDateTime updatedAt) {
    static EquipmentContractorResponse of(RoutingRepository.Contractor contractor) {
        return new EquipmentContractorResponse(
                contractor.equipmentType(), contractor.name(), contractor.email(), contractor.updatedAt());
    }
}
