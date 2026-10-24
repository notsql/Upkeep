package com.proj.server.estate;

import static com.proj.server.estate.CouncilInvitationStatus.IN_APP;
import static com.proj.server.estate.CouncilInvitationStatus.PENDING;
import static com.proj.server.estate.CouncilInvitationStatus.SENDING;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CouncilService {
    private final EstateRepository estates;
    private final CouncilRepository council;
    private final CouncilIdentity identity;

    public CouncilService(EstateRepository estates, CouncilRepository council, CouncilIdentity identity) {
        this.estates = estates;
        this.council = council;
        this.identity = identity;
    }

    private EstateResponse access(UUID id, String user) {
        if (council.hasMembership(id, user) && !council.canInvite(id, user)) {
            throw error(HttpStatus.FORBIDDEN, "Only Managers can manage estate invitations and roles.");
        }
        var estate =
                estates.findAccessible(id, user).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Estate not found."));
        if (!estate.owned() && !council.canInvite(id, user))
            throw error(HttpStatus.FORBIDDEN, "Only Managers can manage estate invitations and roles.");
        return estate;
    }

    public CouncilInvitationResponse invite(UUID estateId, String user, CouncilInvitationRequest request) {
        if (council.mayInviteCustom(estateId, user)) {
            council.authorizeInviter(estateId, user, false).requireActive();
        } else {
            var estate = access(estateId, user);
            if (estate.deactivatedAt() != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
        }
        var owner = identity.user(council.ownerUserId(estateId));
        if (owner.email().equalsIgnoreCase(request.email()))
            throw error(HttpStatus.CONFLICT, "Already a member of this estate.");
        for (var member : council.members(estateId)) {
            var person = identity.user(member.userId());
            if (person.email().equalsIgnoreCase(request.email()))
                throw error(HttpStatus.CONFLICT, "Already a member of this estate.");
        }
        var row = retryInvitationLocks(() -> council.reserve(estateId, user, request));
        if (!SENDING.matches(row.getStatus())) throw error(HttpStatus.CONFLICT, "Already invited or already a member.");
        // A failed dispatch is retried with its original payload and idempotency key.
        var invitation = identity.send(row.getId(), row.getEmail(), row.getInviteruserid());
        if (!row.getEmail().equalsIgnoreCase(invitation.email()) || invitation.expiresAt() == null)
            throw error(HttpStatus.BAD_GATEWAY, "The invitation provider returned an invalid invitation.");
        if (!council.sent(row.getId(), invitation))
            throw error(HttpStatus.CONFLICT, "This invitation changed while being sent. Refresh the invitation list.");
        if ("CUSTOM".equals(row.getRole())) {
            row.setStatus("existing_account".equals(invitation.state()) ? IN_APP.name() : PENDING.name());
            row.setExpiresat(invitation.expiresAt());
            return council.invitationResponse(row);
        }
        return new CouncilInvitationResponse(
                row.getId(),
                estateId,
                row.getEmail(),
                "existing_account".equals(invitation.state()) ? IN_APP.name() : PENDING.name(),
                invitation.expiresAt(),
                EstateRole.valueOf(row.getRole()));
    }

    public List<CouncilInvitationResponse> outstanding(UUID estateId, String user) {
        if (council.mayInviteCustom(estateId, user)) {
            council.authorizeInviter(estateId, user, false);
            return council.outstanding(estateId, user);
        }
        access(estateId, user);
        return council.outstanding(estateId);
    }

    public void cancel(UUID estateId, String user, UUID invitationId) {
        if (!council.mayInviteCustom(estateId, user)) access(estateId, user);
        council.cancel(estateId, invitationId, user);
    }

    public void removeMember(UUID estateId, String user, String member) {
        access(estateId, user);
        if (council.ownerUserId(estateId).equals(member) || user.equals(member))
            throw error(
                    HttpStatus.CONFLICT,
                    "Transfer ownership before removing the owner. Managers cannot remove themselves.");
        if (council.members(estateId).stream()
                .noneMatch(existing -> existing.userId().equals(member)))
            throw error(HttpStatus.NOT_FOUND, "Estate member not found.");
        var person = identity.user(member);
        if (!retryInvitationLocks(
                () -> council.removeMember(estateId, member, person.email().toLowerCase(Locale.ROOT), user)))
            throw error(HttpStatus.NOT_FOUND, "Estate member not found.");
    }

    public List<EstateMemberResponse> members(UUID estateId, String user) {
        access(estateId, user);
        String owner = council.ownerUserId(estateId);
        return council.members(estateId).stream()
                .map(member -> {
                    var person = identity.user(member.userId());
                    return new EstateMemberResponse(
                            member.userId(),
                            person.name(),
                            person.email(),
                            member.canInviteMembers(),
                            member.role(),
                            owner.equals(member.userId()),
                            member.customRoleId(),
                            member.customRoleName());
                })
                .toList();
    }

    public void permission(UUID estateId, String user, String member, boolean allowed) {
        throw error(HttpStatus.FORBIDDEN, "Invitation delegation has been retired. Only Managers can invite.");
    }

    public EstateMemberResponse updateRole(UUID estateId, String actor, String target, EstateRole role) {
        return updateRole(estateId, actor, target, new UpdateEstateRoleRequest(role));
    }

    public EstateMemberResponse updateRole(
            UUID estateId, String actor, String target, UpdateEstateRoleRequest request) {
        access(estateId, actor);
        if (!council.hasMembership(estateId, target)) throw error(HttpStatus.NOT_FOUND, "Estate member not found.");
        var person = identity.user(target);
        var ownerId = council.ownerUserId(estateId);
        var member = retryInvitationLocks(() -> council.updateRole(estateId, actor, target, request));
        return new EstateMemberResponse(
                member.userId(),
                person.name(),
                person.email(),
                member.canInviteMembers(),
                member.role(),
                ownerId.equals(member.userId()),
                member.customRoleId(),
                member.customRoleName());
    }

    public List<EstateInvitationRoleOptionResponse> invitationRoles(UUID estateId, String user) {
        return council.invitationRoles(estateId, user);
    }

    @org.springframework.transaction.annotation.Transactional
    public EstateResponse transferOwnership(UUID estateId, String actor, String target) {
        access(estateId, actor);
        council.transferOwnership(estateId, actor, target);
        return estates.findAccessible(estateId, actor).orElseThrow();
    }

    private CouncilIdentity.Person verifiedPerson(String user) {
        var person = identity.user(user);
        if (!person.verified() || !user.equals(person.id()))
            throw error(HttpStatus.FORBIDDEN, "Verify your email before accepting estate invitations.");
        return person;
    }

    public List<PendingCouncilInvitationResponse> pending(String user) {
        var person = verifiedPerson(user);
        return council.inApp(person.email().toLowerCase(Locale.ROOT));
    }

    public AcceptedInvitationsResponse acceptInApp(UUID id, String user) {
        return acceptInApp(id, user, null);
    }

    public AcceptedInvitationsResponse acceptInApp(UUID id, String user, AcceptEstateInvitationRequest request) {
        var person = verifiedPerson(user);
        var row = council.forRecipient(id, person.email().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Invitation not found for this account."));
        boolean custom = "CUSTOM".equals(row.getRole());
        if (custom && request == null)
            throw error(HttpStatus.BAD_REQUEST, "Review the custom role and include its current version.");
        if (!CouncilInvitationStatus.canAccept(row.getStatus())
                || !(custom
                        ? council.activateExplicit(
                                id, user, java.time.OffsetDateTime.now(), request.expectedRoleVersion())
                        : council.activateExplicit(id, user, java.time.OffsetDateTime.now())))
            throw error(HttpStatus.CONFLICT, "This invitation is no longer available. Ask the estate owner for help.");
        return new AcceptedInvitationsResponse(List.of(row.getEstateid()));
    }

    public AcceptedInvitationsResponse accept(String user) {
        var person = identity.user(user);
        var activated = new ArrayList<UUID>();
        if (!person.verified() || !user.equals(person.id())) return new AcceptedInvitationsResponse(activated);
        for (var row : council.pending(person.email().toLowerCase(Locale.ROOT))) {
            var invitation = identity.invitation(row.getProviderinvitationid());
            if (!row.getProviderinvitationid().equals(invitation.id())
                    || !"accepted".equals(invitation.state())
                    || !user.equals(invitation.acceptedUserId())
                    || !row.getEmail().equalsIgnoreCase(invitation.email())
                    || invitation.acceptedAt() == null
                    || invitation.expiresAt() == null
                    || invitation.acceptedAt().isAfter(invitation.expiresAt())
                    || invitation.acceptedAt().isBefore(row.getCreatedat())) continue;
            if (council.activate(row.getId(), user, invitation.acceptedAt())) activated.add(row.getEstateid());
        }
        return new AcceptedInvitationsResponse(activated);
    }

    private static <T> T retryInvitationLocks(java.util.function.Supplier<T> operation) {
        for (int attempt = 0; attempt < 8; attempt++) {
            try {
                return operation.get();
            } catch (CouncilRepository.InvitationLocksChanged changed) {
                /* Retry after the repository transaction rolled back. */
            }
        }
        throw error(HttpStatus.CONFLICT, "Invitations changed. Refresh and retry this operation.");
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
