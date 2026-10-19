package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateinvitation.ESTATEINVITATION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.estate.CouncilInvitationStatus.ACCEPTED;
import static com.proj.server.estate.CouncilInvitationStatus.CANCELLED;
import static com.proj.server.estate.CouncilInvitationStatus.IN_APP;
import static com.proj.server.estate.CouncilInvitationStatus.PENDING;
import static com.proj.server.estate.CouncilInvitationStatus.SENDING;

import com.proj.server.access.AccessService;
import com.proj.server.db.tables.records.EstateinvitationRecord;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class CouncilRepository {
    private final DSLContext db;

    public CouncilRepository(DSLContext db) {
        this.db = db;
    }

    public boolean canInvite(UUID estateId, String userId) {
        return db.fetchExists(
                ESTATEUSER,
                ESTATEUSER
                        .ESTATEID
                        .eq(estateId)
                        .and(ESTATEUSER.USERID.eq(userId))
                        .and(AccessService.managementMembership())
                        .and(ESTATEUSER.CANINVITEMEMBERS.isTrue()));
    }

    public boolean setPermission(UUID estateId, String userId, boolean allowed) {
        return db.update(ESTATEUSER)
                        .set(ESTATEUSER.CANINVITEMEMBERS, allowed)
                        .where(ESTATEUSER
                                .ESTATEID
                                .eq(estateId)
                                .and(ESTATEUSER.USERID.eq(userId))
                                .and(AccessService.managementMembership()))
                        .execute()
                == 1;
    }

    public List<Member> members(UUID estateId) {
        return db.select(ESTATEUSER.USERID, ESTATEUSER.CANINVITEMEMBERS)
                .from(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(AccessService.managementMembership()))
                .orderBy(ESTATEUSER.CREATEDAT, ESTATEUSER.USERID)
                .fetch(row -> new Member(row.value1(), row.value2()));
    }

    public record Member(String userId, boolean canInviteMembers) {}

    public String ownerUserId(UUID estateId) {
        return db.select(ESTATE.OWNERUSERID)
                .from(ESTATE)
                .where(ESTATE.ID.eq(estateId))
                .fetchSingle(ESTATE.OWNERUSERID);
    }

    // Commit reservation before calling WorkOS: every retry uses the same delivery key.
    // NAME is a legacy non-null column; email-only invitations never read or expose it.
    @Transactional
    public EstateinvitationRecord reserve(UUID estateId, String inviter, CouncilInvitationRequest request) {
        db.insertInto(ESTATEINVITATION)
                .set(ESTATEINVITATION.ID, UUID.randomUUID())
                .set(ESTATEINVITATION.ESTATEID, estateId)
                .set(ESTATEINVITATION.NAME, "")
                .set(ESTATEINVITATION.EMAIL, request.email())
                .set(ESTATEINVITATION.INVITERUSERID, inviter)
                .set(ESTATEINVITATION.STATUS, SENDING.name())
                .set(ESTATEINVITATION.CREATEDAT, OffsetDateTime.now())
                .onConflict(ESTATEINVITATION.ESTATEID, ESTATEINVITATION.EMAIL)
                .doNothing()
                .execute();
        var row = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId).and(ESTATEINVITATION.EMAIL.eq(request.email())))
                .forUpdate()
                .fetchSingle();
        boolean removedRecipient = ACCEPTED.matches(row.getStatus())
                && !db.fetchExists(
                        ESTATEUSER,
                        ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(row.getAccepteduserid())));
        if (!CANCELLED.matches(row.getStatus()) && !removedRecipient) return row;
        // A new attempt gets a new identity; late callbacks for the old ID cannot
        // finalize or activate this replacement. The unique estate/email slot stays.
        return db.update(ESTATEINVITATION)
                .set(ESTATEINVITATION.ID, UUID.randomUUID())
                .set(ESTATEINVITATION.NAME, "")
                .set(ESTATEINVITATION.INVITERUSERID, inviter)
                .set(ESTATEINVITATION.STATUS, SENDING.name())
                .set(ESTATEINVITATION.CREATEDAT, OffsetDateTime.now())
                .setNull(ESTATEINVITATION.PROVIDERINVITATIONID)
                .setNull(ESTATEINVITATION.EXPIRESAT)
                .setNull(ESTATEINVITATION.ACCEPTEDAT)
                .setNull(ESTATEINVITATION.ACCEPTEDUSERID)
                .where(ESTATEINVITATION.ID.eq(row.getId()))
                .returning()
                .fetchSingle();
    }

    public boolean sent(UUID id, CouncilIdentity.Invitation invitation) {
        return db.update(ESTATEINVITATION)
                        .set(ESTATEINVITATION.PROVIDERINVITATIONID, invitation.id())
                        .set(ESTATEINVITATION.EXPIRESAT, invitation.expiresAt())
                        .set(
                                ESTATEINVITATION.STATUS,
                                "existing_account".equals(invitation.state()) ? IN_APP.name() : PENDING.name())
                        .where(ESTATEINVITATION.ID.eq(id).and(ESTATEINVITATION.STATUS.eq(SENDING.name())))
                        .execute()
                == 1;
    }

    public List<CouncilInvitationResponse> outstanding(UUID estateId) {
        return db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION
                        .ESTATEID
                        .eq(estateId)
                        .and(ESTATEINVITATION.STATUS.in(SENDING.name(), PENDING.name(), IN_APP.name())))
                .orderBy(ESTATEINVITATION.CREATEDAT)
                .fetch(row -> new CouncilInvitationResponse(
                        row.getId(), row.getEstateid(), row.getEmail(), row.getStatus(), row.getExpiresat()));
    }

    @Transactional
    public void cancel(UUID estateId, UUID id) {
        var invitation = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ID.eq(id).and(ESTATEINVITATION.ESTATEID.eq(estateId)))
                .forUpdate()
                .fetchOptional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found."));
        if (CANCELLED.matches(invitation.getStatus())) return;
        if (!CouncilInvitationStatus.isOutstanding(invitation.getStatus()))
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This invitation has already been accepted. Remove the member's access instead.");
        db.update(ESTATEINVITATION)
                .set(ESTATEINVITATION.STATUS, CANCELLED.name())
                .where(ESTATEINVITATION.ID.eq(id))
                .execute();
    }

    @Transactional
    public boolean removeMember(UUID estateId, String userId, String email) {
        // Activation locks an invitation before its estate. Use the same order
        // so an already-pending acceptance cannot restore a deleted grant.
        db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId))
                .orderBy(ESTATEINVITATION.ID)
                .forUpdate()
                .fetch();
        db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId)).forUpdate().fetchSingle();
        int removed = db.deleteFrom(ESTATEUSER)
                .where(ESTATEUSER
                        .ESTATEID
                        .eq(estateId)
                        .and(ESTATEUSER.USERID.eq(userId))
                        .and(AccessService.managementMembership()))
                .execute();
        if (removed == 0) return false;
        db.update(ESTATEINVITATION)
                .set(ESTATEINVITATION.STATUS, CANCELLED.name())
                .where(ESTATEINVITATION
                        .ESTATEID
                        .eq(estateId)
                        .and(ESTATEINVITATION.EMAIL.eq(email).or(ESTATEINVITATION.INVITERUSERID.eq(userId)))
                        .and(ESTATEINVITATION.STATUS.in(SENDING.name(), PENDING.name(), IN_APP.name())))
                .execute();
        return true;
    }

    public List<EstateinvitationRecord> pending(String email) {
        return db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.EMAIL.eq(email).and(ESTATEINVITATION.STATUS.eq(PENDING.name())))
                .orderBy(ESTATEINVITATION.CREATEDAT)
                .fetch();
    }

    public List<PendingCouncilInvitationResponse> inApp(String email) {
        return db.select(ESTATEINVITATION.ID, ESTATEINVITATION.ESTATEID, ESTATE.NAME, ESTATEINVITATION.EXPIRESAT)
                .from(ESTATEINVITATION)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ESTATEINVITATION.ESTATEID))
                .where(ESTATEINVITATION
                        .EMAIL
                        .eq(email)
                        .and(ESTATEINVITATION.STATUS.in(IN_APP.name(), PENDING.name()))
                        .and(ESTATEINVITATION.EXPIRESAT.gt(OffsetDateTime.now()))
                        .and(ESTATE.DEACTIVATEDAT.isNull()))
                .orderBy(ESTATEINVITATION.CREATEDAT)
                .fetch(row ->
                        new PendingCouncilInvitationResponse(row.value1(), row.value2(), row.value3(), row.value4()));
    }

    public Optional<EstateinvitationRecord> forRecipient(UUID id, String email) {
        return db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ID.eq(id).and(ESTATEINVITATION.EMAIL.eq(email)))
                .fetchOptional();
    }

    @Transactional
    public boolean activate(UUID invitationId, String userId, OffsetDateTime acceptedAt) {
        return activate(invitationId, userId, acceptedAt, false);
    }

    @Transactional
    public boolean activateExplicit(UUID invitationId, String userId, OffsetDateTime acceptedAt) {
        return activate(invitationId, userId, acceptedAt, true);
    }

    private boolean activate(UUID invitationId, String userId, OffsetDateTime acceptedAt, boolean explicit) {
        var invitation = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ID.eq(invitationId))
                .forUpdate()
                .fetchOptional()
                .orElse(null);
        if (invitation == null) return false;
        boolean inApp = IN_APP.matches(invitation.getStatus());
        if (!CouncilInvitationStatus.canAccept(invitation.getStatus())) return false;
        if ((inApp || explicit)
                && (invitation.getExpiresat() == null
                        || !invitation.getExpiresat().isAfter(OffsetDateTime.now()))) return false;
        var estate = db.selectFrom(ESTATE)
                .where(ESTATE.ID.eq(invitation.getEstateid()))
                .forUpdate()
                .fetchSingle();
        if (estate.getDeactivatedat() != null) return false;
        if (!estate.getOwneruserid().equals(invitation.getInviteruserid())
                && !db.fetchExists(
                        ESTATEUSER,
                        ESTATEUSER
                                .ESTATEID
                                .eq(estate.getId())
                                .and(ESTATEUSER.USERID.eq(invitation.getInviteruserid()))
                                .and(AccessService.managementMembership()))) return false;
        if (db.fetchExists(
                ESTATEUSER,
                ESTATEUSER
                        .ESTATEID
                        .eq(estate.getId())
                        .and(ESTATEUSER.USERID.eq(userId))
                        .and(ESTATEUSER.ROLE.eq("RESIDENT")))) {
            if (explicit)
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "A resident assignment cannot be converted by an invitation.");
            return false;
        }
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate.getId())
                .set(ESTATEUSER.USERID, userId)
                .set(ESTATEUSER.ROLE, "COUNCIL")
                .set(ESTATEUSER.CANINVITEMEMBERS, false)
                .set(ESTATEUSER.CREATEDAT, OffsetDateTime.now())
                .onConflictDoNothing()
                .execute();
        db.update(ESTATEINVITATION)
                .set(ESTATEINVITATION.STATUS, ACCEPTED.name())
                .set(ESTATEINVITATION.ACCEPTEDAT, acceptedAt)
                .set(ESTATEINVITATION.ACCEPTEDUSERID, userId)
                .where(ESTATEINVITATION.ID.eq(invitationId))
                .execute();
        return true;
    }
}
