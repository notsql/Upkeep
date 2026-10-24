package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateinvitation.ESTATEINVITATION;
import static com.proj.server.db.tables.Estateroledefinition.ESTATEROLEDEFINITION;
import static com.proj.server.db.tables.Estaterolepermission.ESTATEROLEPERMISSION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Permission.PERMISSION;
import static com.proj.server.estate.CouncilInvitationStatus.ACCEPTED;
import static com.proj.server.estate.CouncilInvitationStatus.CANCELLED;
import static com.proj.server.estate.CouncilInvitationStatus.IN_APP;
import static com.proj.server.estate.CouncilInvitationStatus.PENDING;
import static com.proj.server.estate.CouncilInvitationStatus.SENDING;

import com.proj.server.access.AccessService;
import com.proj.server.db.tables.records.EstateinvitationRecord;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class CouncilRepository {
    private final DSLContext db;
    private final EstateRoleRepository roles;

    public CouncilRepository(DSLContext db, EstateRoleRepository roles) {
        this.db = db;
        this.roles = roles;
    }

    public boolean canInvite(UUID estateId, String userId) {
        return db.fetchExists(ESTATE, ESTATE.ID.eq(estateId).and(AccessService.managerEstates(userId)));
    }

    public boolean hasMembership(UUID estateId, String user) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(user)));
    }

    public boolean setPermission(UUID estateId, String userId, boolean allowed) {
        throw new ResponseStatusException(
                HttpStatus.FORBIDDEN, "Invitation delegation has been retired. Only Managers can invite.");
    }

    public boolean mayInviteCustom(UUID estateId, String user) {
        return EstatePermissions.has(db, estateId, user, EstatePermissionCode.INVITE_MEMBERS);
    }

    public EstatePermissions.Authority authorizeInviter(UUID estateId, String user, boolean lock) {
        var authority = EstatePermissions.authority(db, estateId, user, lock);
        authority.require(EstatePermissionCode.INVITE_MEMBERS);
        return authority;
    }

    public List<Member> members(UUID estateId) {
        var estate = db.select(ESTATE.OWNERUSERID, ESTATE.DEACTIVATEDAT)
                .from(ESTATE)
                .where(ESTATE.ID.eq(estateId))
                .fetchSingle();
        boolean active = estate.get(ESTATE.DEACTIVATEDAT) == null;
        String owner = estate.get(ESTATE.OWNERUSERID);
        var rows = db.select(ESTATEUSER.USERID, ESTATEUSER.ROLE, ESTATEUSER.CUSTOMROLEID, ESTATEROLEDEFINITION.NAME)
                .from(ESTATEUSER)
                .leftJoin(ESTATEROLEDEFINITION)
                .on(ESTATEROLEDEFINITION
                        .ID
                        .eq(ESTATEUSER.CUSTOMROLEID)
                        .and(ESTATEROLEDEFINITION.ESTATEID.eq(ESTATEUSER.ESTATEID)))
                .where(ESTATEUSER.ESTATEID.eq(estateId))
                .orderBy(ESTATEUSER.CREATEDAT, ESTATEUSER.USERID)
                .fetch();
        var roleIds = rows.getValues(ESTATEUSER.CUSTOMROLEID).stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        var permissions = roles.permissions(estateId, roleIds);
        var members = rows.map(row -> {
            String role = row.get(ESTATEUSER.ROLE);
            boolean manager =
                    !"RESIDENT".equals(role) && (owner.equals(row.get(ESTATEUSER.USERID)) || "MANAGER".equals(role));
            boolean customInviter = "CUSTOM".equals(role)
                    && permissions
                            .getOrDefault(row.get(ESTATEUSER.CUSTOMROLEID), Set.of())
                            .contains(EstatePermissionCode.INVITE_MEMBERS);
            return new Member(
                    row.get(ESTATEUSER.USERID),
                    active && (manager || customInviter),
                    role,
                    row.get(ESTATEUSER.CUSTOMROLEID),
                    row.get(ESTATEROLEDEFINITION.NAME));
        });
        if (members.stream().noneMatch(member -> member.userId().equals(owner)))
            members.addFirst(new Member(owner, active, "MANAGER"));
        return members;
    }

    public record Member(
            String userId, boolean canInviteMembers, String role, UUID customRoleId, String customRoleName) {
        public Member(String userId, boolean canInviteMembers, String role) {
            this(userId, canInviteMembers, role, null, null);
        }

        public Member(String userId, boolean canInviteMembers) {
            this(userId, canInviteMembers, "COUNCIL");
        }
    }

    private void validateTarget(
            EstatePermissions.Authority access, EstateRole role, UUID customId, Integer expectedVersion) {
        if (role != EstateRole.CUSTOM) {
            access.requireManager();
            return;
        }
        var definition = roles.definition(access.estate().getId(), customId, false);
        if (!definition.getVersion().equals(expectedVersion))
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "This role changed. Review its current permissions.");
        var permissions = roles.permissions(access.estate().getId(), customId);
        if (permissions.isEmpty())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This role has no valid permissions.");
        if (!access.manager() && !access.permissions().containsAll(permissions))
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "You can invite only into custom roles within your own permissions.");
    }

    public List<EstateInvitationRoleOptionResponse> invitationRoles(UUID estateId, String user) {
        var access = authorizeInviter(estateId, user, false);
        var choices = new java.util.ArrayList<EstateInvitationRoleOptionResponse>();
        if (access.manager()) {
            for (var role : EstateRole.values()) {
                if (role == EstateRole.CUSTOM) continue;
                String label =
                        switch (role) {
                            case MANAGER -> "Manager (Admin)";
                            case COUNCIL -> "Council member";
                            case RESIDENT -> "Resident";
                            case CREW -> "Crew";
                            default -> throw new IllegalStateException("Unsupported preset role");
                        };
                choices.add(new EstateInvitationRoleOptionResponse(role, label, null, null, null));
            }
        }
        var definitions = roles.definitions(estateId);
        var roleIds = definitions.stream().map(row -> row.getId()).toList();
        var grants = roles.permissions(estateId, roleIds);
        var eligible = definitions.stream()
                .filter(definition -> {
                    var permissions = grants.getOrDefault(definition.getId(), Set.of());
                    return !permissions.isEmpty()
                            && (access.manager() || access.permissions().containsAll(permissions));
                })
                .toList();
        var catalogue = eligible.isEmpty() ? List.<EstatePermissionResponse>of() : roles.catalogue();
        for (var definition : eligible) {
            var permissions = grants.getOrDefault(definition.getId(), Set.of());
            choices.add(new EstateInvitationRoleOptionResponse(
                    EstateRole.CUSTOM,
                    definition.getName(),
                    definition.getId(),
                    definition.getVersion(),
                    catalogue.stream()
                            .filter(entry -> permissions.contains(entry.code()))
                            .toList()));
        }
        return choices;
    }

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
        var row = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId).and(ESTATEINVITATION.EMAIL.eq(request.email())))
                .forUpdate()
                .fetchOne();
        var access = authorizeInviter(estateId, inviter, true);
        access.requireActive();
        validateTarget(access, request.role(), request.customRoleId(), request.expectedRoleVersion());
        if (row == null) {
            // A same-email reservation may have committed while we waited for
            // the estate. Restart rather than locking its invitation backwards.
            if (db.fetchExists(
                    ESTATEINVITATION,
                    ESTATEINVITATION.ESTATEID.eq(estateId).and(ESTATEINVITATION.EMAIL.eq(request.email()))))
                throw new InvitationLocksChanged();
            return db.insertInto(ESTATEINVITATION)
                    .set(ESTATEINVITATION.ID, UUID.randomUUID())
                    .set(ESTATEINVITATION.ESTATEID, estateId)
                    .set(ESTATEINVITATION.NAME, "")
                    .set(ESTATEINVITATION.EMAIL, request.email())
                    .set(ESTATEINVITATION.ROLE, request.role().name())
                    .set(ESTATEINVITATION.CUSTOMROLEID, request.customRoleId())
                    .set(ESTATEINVITATION.INVITERUSERID, inviter)
                    .set(ESTATEINVITATION.STATUS, SENDING.name())
                    .set(ESTATEINVITATION.CREATEDAT, OffsetDateTime.now())
                    .returning()
                    .fetchSingle();
        }
        boolean removedRecipient = ACCEPTED.matches(row.getStatus())
                && !db.fetchExists(
                        ESTATEUSER,
                        ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(row.getAccepteduserid())));
        if (!CANCELLED.matches(row.getStatus()) && !removedRecipient) {
            if (!request.role().name().equals(row.getRole())
                    || !java.util.Objects.equals(request.customRoleId(), row.getCustomroleid())
                    || !inviter.equals(row.getInviteruserid())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "Cancel the outstanding invitation before changing its role or sender.");
            }
            return row;
        }
        // A new attempt gets a new identity; late callbacks for the old ID cannot
        // finalize or activate this replacement. The unique estate/email slot stays.
        return db.update(ESTATEINVITATION)
                .set(ESTATEINVITATION.ID, UUID.randomUUID())
                .set(ESTATEINVITATION.NAME, "")
                .set(ESTATEINVITATION.ROLE, request.role().name())
                .set(ESTATEINVITATION.CUSTOMROLEID, request.customRoleId())
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

    public CouncilInvitationResponse invitationResponse(EstateinvitationRecord row) {
        return invitationResponses(List.of(row)).getFirst();
    }

    private record InvitationRole(
            UUID estateId, String name, int version, List<EstatePermissionResponse> permissions) {}

    private List<CouncilInvitationResponse> invitationResponses(List<EstateinvitationRecord> invitations) {
        var custom = invitations.stream()
                .filter(row -> "CUSTOM".equals(row.getRole()))
                .toList();
        var summaries = new HashMap<UUID, InvitationRole>();
        if (!custom.isEmpty()) {
            var references = custom.stream()
                    .map(row -> DSL.row(row.getCustomroleid(), row.getEstateid()))
                    .distinct()
                    .toList();
            var definitions = db.select(ESTATEROLEDEFINITION.fields())
                    .select(PERMISSION.CODE)
                    .from(ESTATEROLEDEFINITION)
                    .leftJoin(ESTATEROLEPERMISSION)
                    .on(ESTATEROLEPERMISSION.ROLEID.eq(ESTATEROLEDEFINITION.ID))
                    .leftJoin(PERMISSION)
                    .on(PERMISSION.CODE.eq(ESTATEROLEPERMISSION.PERMISSION))
                    .where(DSL.row(ESTATEROLEDEFINITION.ID, ESTATEROLEDEFINITION.ESTATEID)
                            .in(references))
                    .fetchGroups(ESTATEROLEDEFINITION.ID);
            for (var invitation : custom) {
                if (!definitions.containsKey(invitation.getCustomroleid()))
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Custom role not found.");
            }
            var catalogue = roles.catalogue();
            for (var entry : definitions.entrySet()) {
                var definition = entry.getValue().getFirst().into(ESTATEROLEDEFINITION);
                var grants = EstatePermissions.validatedGrants(entry.getValue().getValues(PERMISSION.CODE));
                summaries.put(
                        entry.getKey(),
                        new InvitationRole(
                                definition.getEstateid(),
                                definition.getName(),
                                definition.getVersion(),
                                catalogue.stream()
                                        .filter(permission -> grants.contains(permission.code()))
                                        .toList()));
            }
        }
        return invitations.stream()
                .map(row -> {
                    if (!"CUSTOM".equals(row.getRole()))
                        return new CouncilInvitationResponse(
                                row.getId(),
                                row.getEstateid(),
                                row.getEmail(),
                                row.getStatus(),
                                row.getExpiresat(),
                                EstateRole.valueOf(row.getRole()));
                    var definition = summaries.get(row.getCustomroleid());
                    if (!row.getEstateid().equals(definition.estateId()))
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Custom role not found.");
                    return new CouncilInvitationResponse(
                            row.getId(),
                            row.getEstateid(),
                            row.getEmail(),
                            row.getStatus(),
                            row.getExpiresat(),
                            EstateRole.CUSTOM,
                            row.getCustomroleid(),
                            definition.version(),
                            definition.name(),
                            definition.permissions());
                })
                .toList();
    }

    public List<CouncilInvitationResponse> outstanding(UUID estateId) {
        return outstanding(estateId, null);
    }

    public List<CouncilInvitationResponse> outstanding(UUID estateId, String sender) {
        var condition = ESTATEINVITATION
                .ESTATEID
                .eq(estateId)
                .and(ESTATEINVITATION.STATUS.in(SENDING.name(), PENDING.name(), IN_APP.name()));
        if (sender != null) condition = condition.and(ESTATEINVITATION.INVITERUSERID.eq(sender));
        var invitations = db.selectFrom(ESTATEINVITATION)
                .where(condition)
                .orderBy(ESTATEINVITATION.CREATEDAT)
                .fetch();
        return invitationResponses(invitations);
    }

    @Transactional
    public void cancel(UUID estateId, UUID id, String actor) {
        var invitation = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ID.eq(id).and(ESTATEINVITATION.ESTATEID.eq(estateId)))
                .forUpdate()
                .fetchOptional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found."));
        var access = authorizeInviter(estateId, actor, true);
        if (!access.manager() && !actor.equals(invitation.getInviteruserid()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found.");
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
    public boolean removeMember(UUID estateId, String userId, String email, String actor) {
        var locked = lockInvitations(estateId);
        var estate = requireManager(estateId, actor);
        ensureInvitationsLocked(estateId, locked);
        protectMember(estate.getOwneruserid(), actor, userId);
        int removed = db.deleteFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(userId)))
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
        var rows = db.select(ESTATEINVITATION.fields())
                .select(ESTATE.NAME)
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
                .fetch();
        var estateNames = rows.intoMap(ESTATEINVITATION.ID, ESTATE.NAME);
        return invitationResponses(rows.into(ESTATEINVITATION)).stream()
                .map(offer -> new PendingCouncilInvitationResponse(
                        offer.id(),
                        offer.estateId(),
                        estateNames.get(offer.id()),
                        offer.expiresAt(),
                        offer.role(),
                        offer.customRoleId(),
                        offer.customRoleVersion(),
                        offer.customRoleName(),
                        offer.customPermissions()))
                .toList();
    }

    public Optional<EstateinvitationRecord> forRecipient(UUID id, String email) {
        return db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ID.eq(id).and(ESTATEINVITATION.EMAIL.eq(email)))
                .fetchOptional();
    }

    @Transactional
    public boolean activate(UUID invitationId, String userId, OffsetDateTime acceptedAt) {
        return activate(invitationId, userId, acceptedAt, false, null);
    }

    @Transactional
    public boolean activateExplicit(UUID invitationId, String userId, OffsetDateTime acceptedAt) {
        return activate(invitationId, userId, acceptedAt, true, null);
    }

    @Transactional
    public boolean activateExplicit(
            UUID invitationId, String userId, OffsetDateTime acceptedAt, Integer expectedRoleVersion) {
        return activate(invitationId, userId, acceptedAt, true, expectedRoleVersion);
    }

    private boolean activate(
            UUID invitationId,
            String userId,
            OffsetDateTime acceptedAt,
            boolean explicit,
            Integer expectedRoleVersion) {
        var invitation = db.selectFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ID.eq(invitationId))
                .forUpdate()
                .fetchOptional()
                .orElse(null);
        if (invitation == null) {
            if (explicit) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invitation not found.");
            return false;
        }
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
                && !hasMembership(estate.getId(), invitation.getInviteruserid())) return false;
        if ("CUSTOM".equals(invitation.getRole())) {
            var definition = db.selectFrom(ESTATEROLEDEFINITION)
                    .where(ESTATEROLEDEFINITION
                            .ID
                            .eq(invitation.getCustomroleid())
                            .and(ESTATEROLEDEFINITION.ESTATEID.eq(estate.getId())))
                    .fetchOne();
            if (definition == null
                    || roles.permissions(estate.getId(), definition.getId()).isEmpty()) return false;
            if (explicit && !definition.getVersion().equals(expectedRoleVersion))
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "The offered role changed. Review its current permissions before accepting.");
        }
        // Invitations never overwrite or resurrect an existing membership,
        // including a matching role created by a separate explicit assignment.
        if (estate.getOwneruserid().equals(userId)
                || db.fetchExists(
                        ESTATEUSER, ESTATEUSER.ESTATEID.eq(estate.getId()).and(ESTATEUSER.USERID.eq(userId)))) {
            if (explicit)
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "An existing estate membership cannot be converted by an invitation.");
            return false;
        }
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate.getId())
                .set(ESTATEUSER.USERID, userId)
                .set(ESTATEUSER.ROLE, invitation.getRole())
                .set(ESTATEUSER.CUSTOMROLEID, invitation.getCustomroleid())
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

    private com.proj.server.db.tables.records.EstateRecord requireManager(UUID id, String actor) {
        var estate = db.selectFrom(ESTATE)
                .where(ESTATE.ID.eq(id))
                .forUpdate()
                .fetchOptional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estate not found."));
        if (!canInvite(id, actor))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Manager access to this estate is required.");
        return estate;
    }

    private java.util.Set<UUID> lockInvitations(UUID estateId) {
        return db.select(ESTATEINVITATION.ID)
                .from(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId))
                .orderBy(ESTATEINVITATION.ID)
                .forUpdate()
                .fetchSet(ESTATEINVITATION.ID);
    }

    private void ensureInvitationsLocked(UUID estateId, java.util.Set<UUID> locked) {
        var current = db.select(ESTATEINVITATION.ID)
                .from(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estateId))
                .fetchSet(ESTATEINVITATION.ID);
        if (!locked.containsAll(current)) throw new InvitationLocksChanged();
    }

    static final class InvitationLocksChanged extends RuntimeException {}

    private static void protectMember(String owner, String actor, String target) {
        if (owner.equals(target))
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Transfer ownership before removing or demoting the owner.");
        if (actor.equals(target))
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A Manager cannot remove or demote themselves. Ask another Manager.");
    }

    @Transactional
    public Member updateRole(UUID estateId, String actor, String target, EstateRole role) {
        return updateRole(estateId, actor, target, new UpdateEstateRoleRequest(role));
    }

    @Transactional
    public Member updateRole(UUID estateId, String actor, String target, UpdateEstateRoleRequest request) {
        var role = request.role();
        var locked = lockInvitations(estateId);
        var estate = requireManager(estateId, actor);
        ensureInvitationsLocked(estateId, locked);
        if (estate.getDeactivatedat() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This estate is inactive.");
        if (role == EstateRole.CUSTOM)
            validateTarget(
                    EstatePermissions.authority(db, estateId, actor, false),
                    role,
                    request.customRoleId(),
                    request.expectedRoleVersion());
        var member = db.selectFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(target)))
                .forUpdate()
                .fetchOptional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estate member not found."));
        if (!role.name().equals(member.getRole())
                || !java.util.Objects.equals(request.customRoleId(), member.getCustomroleid())) {
            protectMember(estate.getOwneruserid(), actor, target);
            db.update(ESTATEUSER)
                    .set(ESTATEUSER.ROLE, role.name())
                    .set(ESTATEUSER.CUSTOMROLEID, request.customRoleId())
                    .set(ESTATEUSER.CANINVITEMEMBERS, false)
                    .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(target)))
                    .execute();
            if ("MANAGER".equals(member.getRole()) && role != EstateRole.CUSTOM) {
                db.update(ESTATEINVITATION)
                        .set(ESTATEINVITATION.STATUS, CANCELLED.name())
                        .where(ESTATEINVITATION
                                .ESTATEID
                                .eq(estateId)
                                .and(ESTATEINVITATION.INVITERUSERID.eq(target))
                                .and(ESTATEINVITATION.STATUS.in(SENDING.name(), PENDING.name(), IN_APP.name())))
                        .execute();
            }
        }
        return db.select(ESTATEUSER.USERID, ESTATEUSER.ROLE, ESTATEUSER.CUSTOMROLEID, ESTATEROLEDEFINITION.NAME)
                .from(ESTATEUSER)
                .leftJoin(ESTATEROLEDEFINITION)
                .on(ESTATEROLEDEFINITION
                        .ID
                        .eq(ESTATEUSER.CUSTOMROLEID)
                        .and(ESTATEROLEDEFINITION.ESTATEID.eq(ESTATEUSER.ESTATEID)))
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(target)))
                .fetchSingle(row -> new Member(
                        row.get(ESTATEUSER.USERID),
                        canInvite(estateId, target) || mayInviteCustom(estateId, target),
                        row.get(ESTATEUSER.ROLE),
                        row.get(ESTATEUSER.CUSTOMROLEID),
                        row.get(ESTATEROLEDEFINITION.NAME)));
    }

    @Transactional
    public void transferOwnership(UUID estateId, String actor, String target) {
        var estate = requireManager(estateId, actor);
        if (!estate.getOwneruserid().equals(actor))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the current owner can transfer ownership.");
        if (actor.equals(target)
                || !db.fetchExists(
                        ESTATEUSER,
                        ESTATEUSER
                                .ESTATEID
                                .eq(estateId)
                                .and(ESTATEUSER.USERID.eq(target))
                                .and(ESTATEUSER.ROLE.eq("MANAGER")))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "The recipient must already be another Manager in this estate.");
        }
        // Ownership already grants Manager authority. Persist it for a legacy
        // owner without a membership so transfer does not remove their access.
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estateId)
                .set(ESTATEUSER.USERID, actor)
                .set(ESTATEUSER.ROLE, "MANAGER")
                .setNull(ESTATEUSER.CUSTOMROLEID)
                .set(ESTATEUSER.CANINVITEMEMBERS, false)
                .set(ESTATEUSER.CREATEDAT, OffsetDateTime.now())
                .onConflict(ESTATEUSER.ESTATEID, ESTATEUSER.USERID)
                .doUpdate()
                .set(ESTATEUSER.ROLE, "MANAGER")
                .setNull(ESTATEUSER.CUSTOMROLEID)
                .set(ESTATEUSER.CANINVITEMEMBERS, false)
                .execute();
        db.update(ESTATE)
                .set(ESTATE.OWNERUSERID, target)
                .set(ESTATE.UPDATEDAT, OffsetDateTime.now())
                .where(ESTATE.ID.eq(estateId))
                .execute();
    }
}
