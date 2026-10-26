package com.proj.server.inspection;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.multipart.MultipartFile;

public record CreateInspectionRequest(
        @NotNull InspectionOutcome outcome,

        @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate inspectedOn,

        String notes,
        @NotNull UUID expectedLocationId,
        List<MultipartFile> photos) {}
