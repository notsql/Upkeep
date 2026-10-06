package com.proj.server.estate;

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

    private EstateResponse access(UUID id, String user, boolean ownerOnly) {
        var estate =
                estates.findAccessible(id, user).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Estate not found."));
        if (!estate.owned() && (ownerOnly || !council.canInvite(id, user)))
            throw error(
                    HttpStatus.FORBIDDEN,
                    ownerOnly
                            ? "Only the estate owner can manage invitation permissions."
                            : "You cannot invite members to this estate.");
        return estate;
    }

    public CouncilInvitationResponse invite(UUID estateId, String user, CouncilInvitationRequest request) {
        var estate = access(estateId, user, false);
        if (estate.deactivatedAt() != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
        var owner = identity.user(council.ownerUserId(estateId));
        if (owner.email().equalsIgnoreCase(request.email()))
            throw error(HttpStatus.CONFLICT, "Already a member of this estate.");
        for (var member : council.members(estateId)) {
            var person = identity.user(member.userId());
            if (person.email().equalsIgnoreCase(request.email()))
                throw error(HttpStatus.CONFLICT, "Already a member of this estate.");
        }
        var row = council.reserve(estateId, user, request);
        if (!"SENDING".equals(row.getStatus()))
            throw error(HttpStatus.CONFLICT, "Already invited or already a member.");
        // A failed dispatch is retried with its original payload and idempotency key.
        var invitation = identity.send(row.getId(), row.getEmail(), row.getInviteruserid());
        if (!row.getEmail().equalsIgnoreCase(invitation.email()) || invitation.expiresAt() == null)
            throw error(HttpStatus.BAD_GATEWAY, "The invitation provider returned an invalid invitation.");
        if (!council.sent(row.getId(), invitation))
            throw error(HttpStatus.CONFLICT, "This invitation changed while being sent. Refresh the invitation list.");
        return new CouncilInvitationResponse(
                row.getId(),
                estateId,
                row.getEmail(),
                "existing_account".equals(invitation.state()) ? "IN_APP" : "PENDING",
                invitation.expiresAt());
    }

    public List<CouncilInvitationResponse> outstanding(UUID estateId, String user) {
        access(estateId, user, true);
        return council.outstanding(estateId);
    }

    public void cancel(UUID estateId, String user, UUID invitationId) {
        access(estateId, user, true);
        council.cancel(estateId, invitationId);
    }

    public void removeMember(UUID estateId, String user, String member) {
        access(estateId, user, true);
        if (council.ownerUserId(estateId).equals(member))
            throw error(HttpStatus.CONFLICT, "The estate owner cannot remove their own access.");
        if (council.members(estateId).stream()
                .noneMatch(existing -> existing.userId().equals(member)))
            throw error(HttpStatus.NOT_FOUND, "Estate member not found.");
        var person = identity.user(member);
        if (!council.removeMember(estateId, member, person.email().toLowerCase(Locale.ROOT)))
            throw error(HttpStatus.NOT_FOUND, "Estate member not found.");
    }

    public List<EstateMemberResponse> members(UUID estateId, String user) {
        access(estateId, user, true);
        return council.members(estateId).stream()
                .map(member -> {
                    var person = identity.user(member.userId());
                    return new EstateMemberResponse(
                            member.userId(), person.name(), person.email(), member.canInviteMembers());
                })
                .toList();
    }

    public void permission(UUID estateId, String user, String member, boolean allowed) {
        access(estateId, user, true);
        if (!council.setPermission(estateId, member, allowed))
            throw error(HttpStatus.NOT_FOUND, "Estate member not found.");
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
        var person = verifiedPerson(user);
        var row = council.forRecipient(id, person.email().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Invitation not found for this account."));
        if (!List.of("IN_APP", "PENDING").contains(row.getStatus())
                || !council.activateExplicit(id, user, java.time.OffsetDateTime.now()))
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

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
