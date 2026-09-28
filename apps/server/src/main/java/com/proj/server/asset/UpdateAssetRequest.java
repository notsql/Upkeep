package com.proj.server.asset;

import static com.proj.server.asset.CreateAssetRequest.blankToNull;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/** Full replacement of an asset's editable details. The reference is never editable, so it is not a field here. */
public record UpdateAssetRequest(
        @NotBlank @Size(max = 200) String name,
        @NotNull AssetCategory category,
        @NotNull UUID locationId,
        LocalDate installedOn,
        @Size(max = 200) String manufacturer,
        @Size(max = 200) String model,
        @Size(max = 200) String serialNumber) {
    public UpdateAssetRequest {
        name = name == null ? null : name.strip();
        manufacturer = blankToNull(manufacturer);
        model = blankToNull(model);
        serialNumber = blankToNull(serialNumber);
    }
}
