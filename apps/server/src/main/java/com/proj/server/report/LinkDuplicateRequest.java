package com.proj.server.report;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Links a report to an original by hand. The link is saved as CONFIRMED with source MANUAL, replacing a REJECTED
 * link; a SUSPECTED or CONFIRMED link must be rejected first.
 */
public record LinkDuplicateRequest(@NotNull UUID originalReportId) {}
