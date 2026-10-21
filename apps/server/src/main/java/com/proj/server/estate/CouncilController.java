package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Insufficient estate permissions",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or member not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Duplicate invitation or inactive estate",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "502",
            description = "Identity provider failed",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "Identity provider not configured",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class CouncilController {
    private final CouncilService service;

    public CouncilController(CouncilService service) {
        this.service = service;
    }

    @PostMapping("/estates/{estateId}/council-invitations")
    @ResponseStatus(HttpStatus.CREATED)
    @ApiResponse(responseCode = "201", description = "Invitation sent")
    public CouncilInvitationResponse invite(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @Valid @RequestBody CouncilInvitationRequest request) {
        return service.invite(estateId, user(jwt), request);
    }

    @GetMapping("/estates/{estateId}/council-invitations")
    @ApiResponse(
            responseCode = "200",
            description = "Outstanding invitations, including sending and expired invitations")
    public List<CouncilInvitationResponse> outstanding(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.outstanding(estateId, user(jwt));
    }

    @DeleteMapping("/estates/{estateId}/council-invitations/{invitationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "Invitation cancelled for this estate", content = @Content)
    public void cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID invitationId) {
        service.cancel(estateId, user(jwt), invitationId);
    }

    @DeleteMapping("/estates/{estateId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "Member access removed from this estate", content = @Content)
    public void removeMember(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable String userId) {
        service.removeMember(estateId, user(jwt), userId);
    }

    @GetMapping("/estates/{estateId}/members")
    @ApiResponse(responseCode = "200", description = "Estate members and invitation permissions")
    public List<EstateMemberResponse> members(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.members(estateId, user(jwt));
    }

    @PutMapping("/estates/{estateId}/members/{userId}/role")
    @ApiResponse(
            responseCode = "200",
            description = "Estate role updated; Manager self-demotion and owner demotion are protected")
    public EstateMemberResponse updateRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable String userId,
            @Valid @RequestBody UpdateEstateRoleRequest request) {
        return service.updateRole(estateId, user(jwt), userId, request.role());
    }

    @PostMapping("/estates/{estateId}/ownership-transfer")
    @ApiResponse(responseCode = "200", description = "Ownership transferred to an existing Manager in this estate")
    public EstateResponse transferOwnership(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @Valid @RequestBody TransferOwnershipRequest request) {
        return service.transferOwnership(estateId, user(jwt), request.newOwnerUserId());
    }

    @PutMapping("/estates/{estateId}/members/{userId}/invitation-permission")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(responseCode = "204", description = "Invitation permission saved", content = @Content)
    public void permission(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable String userId,
            @Valid @RequestBody InvitationPermissionRequest request) {
        service.permission(estateId, user(jwt), userId, request.canInviteMembers());
    }

    @PostMapping("/council-invitations/accept")
    @ApiResponse(responseCode = "200", description = "Estate memberships activated from verified WorkOS acceptances")
    public AcceptedInvitationsResponse accept(@AuthenticationPrincipal Jwt jwt) {
        return service.accept(user(jwt));
    }

    @GetMapping("/council-invitations")
    @ApiResponse(responseCode = "200", description = "Pending in-app invitations for the verified signed-in recipient")
    public List<PendingCouncilInvitationResponse> pending(@AuthenticationPrincipal Jwt jwt) {
        return service.pending(user(jwt));
    }

    @PostMapping("/council-invitations/{invitationId}/accept")
    @ApiResponse(responseCode = "200", description = "Explicitly accept one in-app estate invitation")
    public AcceptedInvitationsResponse acceptInApp(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID invitationId) {
        return service.acceptInApp(invitationId, user(jwt));
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to manage estate members.");
        return jwt.getSubject();
    }
}
