package com.proj.server.dashboard;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    @Operation(summary = "Summarise your estates and active assets in estates you own")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "User-scoped portfolio summary"),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "503",
                description = "Summary temporarily unavailable",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public DashboardSummaryResponse summary(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to view your dashboard.");
        }
        return service.summary(jwt.getSubject());
    }
}
