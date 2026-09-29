package com.proj.server.workos;

import com.proj.server.admin.AdminUserResponse;
import com.workos.WorkOS;
import com.workos.common.exceptions.WorkOSException;
import com.workos.models.SlimRole;
import com.workos.organizationmembership.CreateUserRole;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkOSService {
    private final WorkOS client;
    private final String apiKey;

    @Autowired
    public WorkOSService(@Value("${app.workos.api-key}") String apiKey) {
        this(apiKey, new WorkOS(apiKey));
    }

    WorkOSService(String apiKey, WorkOS client) {
        this.apiKey = apiKey;
        this.client = client;
    }

    public List<Organization> getOrganizations() {
        return execute(() -> {
            var organizations = new ArrayList<Organization>();

            for (var organization : client.getOrganizations().list().autoPagingIterable()) {
                organizations.add(new Organization(organization.getId(), organization.getName()));
            }

            return organizations;
        });
    }

    public List<Role> getOrganizationRoles(String organizationId) {
        return execute(() -> client.getAuthorization().listOrganizationRoles(organizationId).getData().stream()
                .map(role -> new Role(
                        role.getId(), role.getSlug(), role.getName(), role.getDescription(), role.getPermissions()))
                .toList());
    }

    public List<AdminUserResponse> getMembers(String organizationId) {
        return execute(() -> {
            var members = new ArrayList<AdminUserResponse>();
            var memberships = client.getOrganizationMembership().list(null, null, 100, null, organizationId);

            for (var membership : memberships.autoPagingIterable()) {
                var user = membership.getUser();

                if (user == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Missing WorkOS user");
                }

                String name = formatName(user.getFirstName(), user.getLastName(), user.getEmail());

                List<SlimRole> roles = membership.getRoles();
                if (roles == null) {
                    roles = membership.getRole() == null ? List.of() : List.of(membership.getRole());
                }

                members.add(new AdminUserResponse(
                        membership.getId(),
                        membership.getUserId(),
                        name,
                        user.getEmail(),
                        membership.getCreatedAt().toString(),
                        roles.stream().map(SlimRole::getSlug).toList()));
            }

            return members;
        });
    }

    public UserRoles updateRole(String membershipId, UserRoles request) {
        validateRoles(request);

        execute(() -> client.getOrganizationMembership()
                .update(membershipId, new CreateUserRole.Multiple(request.roleSlugs())));

        return request;
    }

    /** A user's name for display, or empty if WorkOS is unavailable. Never throws. */
    public Optional<String> findDisplayName(String userId) {
        if (apiKey.isBlank()) {
            return Optional.empty();
        }
        try {
            var user = client.getUserManagement().get(userId);
            return Optional.ofNullable(formatName(user.getFirstName(), user.getLastName(), user.getEmail()));
        } catch (WorkOSException exception) {
            return Optional.empty();
        }
    }

    private <T> T execute(Supplier<T> operation) {
        requireConfigured();

        try {
            return operation.get();
        } catch (WorkOSException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "WorkOS request failed", exception);
        }
    }

    private static String formatName(String firstName, String lastName, String fallbackEmail) {
        String name = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();

        return name.isEmpty() ? fallbackEmail : name;
    }

    private static void validateRoles(UserRoles request) {
        if (request.roleSlugs() == null
                || request.roleSlugs().isEmpty()
                || request.roleSlugs().stream().anyMatch(role -> role == null || role.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one role is required");
        }
    }

    private void requireConfigured() {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "WorkOS is not configured");
        }
    }
}
