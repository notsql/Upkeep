package com.proj.server.help;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class WhoCanHelpController {
    private final WhoCanHelpService service;

    public WhoCanHelpController(WhoCanHelpService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/who-can-help")
    @Operation(operationId = "whoCanHelp", summary = "The roles in this estate whose members can do an action")
    @ApiResponse(responseCode = "200", description = "Role names, the estate owner last; empty when nobody can")
    @ApiResponse(responseCode = "400", description = "Unknown action", content = @Content)
    @ApiResponse(responseCode = "404", description = "Not a member of the estate", content = @Content)
    public WhoCanHelpResponse whoCanHelp(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @Parameter(required = true) @RequestParam HelpAction action) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to continue.");
        }
        return service.whoCanHelp(estateId, jwt.getSubject(), action);
    }
}
