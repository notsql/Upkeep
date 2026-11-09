package com.proj.server.report;

import com.proj.server.resident.ResidentReportException;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;

public record ChangeReportUrgencyRequest(
        @NotNull ReportUrgency urgency,
        @NotNull Boolean isSafety,
        @NotNull @Min(0) Integer expectedVersion) {
    public void validate() {
        if (Boolean.TRUE.equals(isSafety) && urgency != ReportUrgency.URGENT)
            throw new ResidentReportException(HttpStatus.BAD_REQUEST, "Safety reports must be Urgent.");
    }
}
