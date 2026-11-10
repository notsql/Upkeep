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

        @io.swagger.v3.oas.annotations.media.Schema(
                description = "Up to 2,000 characters. Required (not blank) when outcome is FAIL: what is wrong.")
        String notes,

        @NotNull UUID expectedLocationId,
        List<MultipartFile> photos) {}
