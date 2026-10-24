package com.proj.server.estate;

import static com.proj.server.estate.EstatePermissions.error;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class EstateRoleService {
    private static final Set<String> RESERVED = Set.of(
            "manager", "admin", "manager (admin)", "council", "council member", "resident", "crew", "member", "owner");
    private final EstateRoleRepository repository;
    private final TransactionTemplate transactions;

    public EstateRoleService(EstateRoleRepository repository, PlatformTransactionManager manager) {
        this.repository = repository;
        this.transactions = new TransactionTemplate(manager);
    }

    private EstatePermissions.Authority author(UUID estate, String user, boolean lock) {
        var access = repository.authority(estate, user, lock);
        if (!access.has(EstatePermissionCode.CREATE_ROLES) && !access.has(EstatePermissionCode.EDIT_ROLES))
            throw error(HttpStatus.FORBIDDEN, "Role-authoring access is required.");
        return access;
    }

    public List<EstatePermissionResponse> catalogue(UUID estate, String user) {
        var access = author(estate, user, false);
        return repository.catalogue().stream()
                .filter(code -> access.has(code.code()))
                .toList();
    }

    public List<EstateRoleDefinitionResponse> list(UUID estate, String user) {
        var access = author(estate, user, false);
        var definitions = repository.definitions(estate);
        var roleIds = definitions.stream().map(row -> row.getId()).toList();
        var permissions = repository.permissions(estate, roleIds);
        var assigned = repository.assignedRoles(estate, roleIds);
        return definitions.stream()
                .filter(row -> access.manager()
                        || access.permissions().containsAll(permissions.getOrDefault(row.getId(), Set.of())))
                .map(row -> repository.response(
                        row, access, permissions.getOrDefault(row.getId(), Set.of()), assigned.contains(row.getId())))
                .toList();
    }

    @Transactional
    public EstateRoleDefinitionResponse create(UUID estate, String user, CreateEstateRoleRequest request) {
        var access = author(estate, user, true);
        access.require(EstatePermissionCode.CREATE_ROLES);
        access.requireActive();
        var selected = validate(request.name(), request.permissions());
        repository.catalogue();
        if (!access.manager() && !access.permissions().containsAll(selected))
            throw error(HttpStatus.FORBIDDEN, "You can grant only permissions you currently hold.");
        String key = request.name().toLowerCase(Locale.ROOT);
        if (repository.nameTaken(estate, key, null)) throw duplicate();
        return repository.response(
                repository.create(estate, user, request.name(), key, request.description(), selected),
                access,
                selected,
                false);
    }

    @Transactional
    public EstateRoleDefinitionResponse update(
            UUID estate, UUID id, String user, UpdateEstateRoleDefinitionRequest request) {
        var access = author(estate, user, true);
        access.require(EstatePermissionCode.EDIT_ROLES);
        access.requireActive();
        var row = repository.definition(estate, id, true);
        var current = repository.permissions(estate, id);
        var proposed = validate(request.name(), request.permissions());
        repository.catalogue();
        if (!access.manager()
                && (id.equals(access.customRoleId())
                        || !access.permissions().containsAll(current)
                        || !access.permissions().containsAll(proposed)))
            throw error(
                    HttpStatus.FORBIDDEN, "You cannot edit your assigned role or grant permissions beyond your own.");
        if (row.getVersion().intValue() != request.expectedVersion())
            throw error(HttpStatus.CONFLICT, "This role changed. Refresh before editing it.");
        String key = request.name().toLowerCase(Locale.ROOT);
        if (repository.nameTaken(estate, key, id)) throw duplicate();
        boolean assigned = repository.assignedRoles(estate, List.of(id)).contains(id);
        if (row.getName().equals(request.name())
                && Objects.equals(row.getDescription(), request.description())
                && current.equals(proposed)) return repository.response(row, access, current, assigned);
        return repository.response(
                repository.update(row, request.name(), key, request.description(), proposed),
                access,
                proposed,
                assigned);
    }

    public void delete(UUID estate, UUID id, String user) {
        repository.authority(estate, user, false).requireManager();
        // Keep retries outside each transaction: new reservations require us to
        // release the estate before locking the complete invitation set again.
        for (int attempt = 0; attempt < 8; attempt++) {
            boolean deleted = Boolean.TRUE.equals(transactions.execute(transaction -> {
                var locked = repository.invitationIds(estate, id, true);
                var access = repository.authority(estate, user, true);
                access.requireManager();
                access.requireActive();
                repository.definition(estate, id, true);
                if (!locked.containsAll(repository.invitationIds(estate, id, false))) {
                    transaction.setRollbackOnly();
                    return false;
                }
                if (repository.assigned(id))
                    throw error(HttpStatus.CONFLICT, "Reassign or remove the members holding this role first.");
                repository.delete(estate, id);
                return true;
            }));
            if (deleted) return;
        }
        throw error(HttpStatus.CONFLICT, "Invitations changed. Refresh and retry deleting this role.");
    }

    private static Set<EstatePermissionCode> validate(String name, List<EstatePermissionCode> permissions) {
        if (name == null || name.isBlank() || name.length() > 40 || RESERVED.contains(name.toLowerCase(Locale.ROOT)))
            throw error(HttpStatus.BAD_REQUEST, "Choose a non-reserved role name of at most 40 characters.");
        if (permissions == null || permissions.isEmpty() || permissions.contains(null))
            throw error(HttpStatus.BAD_REQUEST, "Choose at least one supported permission.");
        var selected = new HashSet<>(permissions);
        if (selected.size() != permissions.size()
                || selected.stream().anyMatch(code -> !selected.containsAll(code.requires())))
            throw error(HttpStatus.BAD_REQUEST, "Permissions must be unique and include their required permissions.");
        return Set.copyOf(selected);
    }

    private static org.springframework.web.server.ResponseStatusException duplicate() {
        return error(HttpStatus.CONFLICT, "A role with this name already exists in this estate.");
    }
}
