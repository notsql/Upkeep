package com.proj.server.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Full replacement of a location's editable details. Changing parentId moves it; its type never changes. */
public record UpdateLocationRequest(
        UUID parentId, @NotBlank @Size(max = 200) String name, Integer sortOrder) {
    public UpdateLocationRequest {
        name = name == null ? null : name.strip();
    }
}
