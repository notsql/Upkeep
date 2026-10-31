package com.proj.server.category;

import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.annotation.JsonDeserialize;

public record SetSilentFailureRequest(
        @NotNull @JsonDeserialize(using = StrictBooleanDeserializer.class)
        Boolean failsSilently) {}
