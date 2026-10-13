package com.proj.server.admin;

import com.proj.server.workos.Organization;
import com.proj.server.workos.Role;
import com.proj.server.workos.UserRoles;
import com.proj.server.workos.WorkOSService;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
public class AdminController {
    private final WorkOSService workOSService;

    public AdminController(WorkOSService workOSService) {
        this.workOSService = workOSService;
    }

    @GetMapping("/organization/all")
    public List<Organization> getOrganizations() {
        return workOSService.getOrganizations();
    }

    @GetMapping("/organization/{organizationId}/roles")
    public List<Role> getOrganizationRoles(@PathVariable String organizationId) {
        return workOSService.getOrganizationRoles(organizationId);
    }

    @GetMapping("/organization/{organizationId}/members")
    public List<AdminUserResponse> getMembers(@PathVariable String organizationId) {
        return workOSService.getMembers(organizationId);
    }

    @PutMapping("/{membershipId}/role")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Role updated"),
        @ApiResponse(
                responseCode = "400",
                description = "Invalid roles",
                content = @Content(schema = @Schema(implementation = AdminError.class))),
        @ApiResponse(responseCode = "401", description = "Sign in required", content = @Content),
        @ApiResponse(responseCode = "403", description = "Admin role required", content = @Content),
        @ApiResponse(
                responseCode = "409",
                description = "Role safeguard rejected the update",
                content = @Content(schema = @Schema(implementation = AdminError.class))),
        @ApiResponse(
                responseCode = "502",
                description = "WorkOS request failed",
                content = @Content(schema = @Schema(implementation = AdminError.class))),
        @ApiResponse(
                responseCode = "503",
                description = "WorkOS is not configured",
                content = @Content(schema = @Schema(implementation = AdminError.class)))
    })
    public UserRoles updateRole(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String membershipId, @RequestBody UserRoles request) {
        return workOSService.updateRole(subject(jwt), membershipId, request);
    }

    private static String subject(Jwt jwt) {
        return jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank() ? null : jwt.getSubject();
    }
}
