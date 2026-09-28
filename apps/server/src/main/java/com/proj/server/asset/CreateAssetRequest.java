package com.proj.server.asset;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record CreateAssetRequest(
        @NotBlank @Size(max = 200) String name,
        @NotNull AssetCategory category,
        @NotNull UUID locationId,
        LocalDate installedOn,
        @Size(max = 200) String manufacturer,
        @Size(max = 200) String model,
        @Size(max = 200) String serialNumber) {
    public CreateAssetRequest {
        name = name == null ? null : name.strip();
        manufacturer = blankToNull(manufacturer);
        model = blankToNull(model);
        serialNumber = blankToNull(serialNumber);
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
