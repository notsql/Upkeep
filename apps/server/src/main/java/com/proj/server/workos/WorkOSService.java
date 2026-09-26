package com.proj.server.workos;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.proj.server.admin.AdminUserResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkOSService {
    private final RestClient client;
    private final String apiKey;

    public WorkOSService(
            RestClient.Builder builder,
            @Value("${WORKOS_API_BASE_URL}") String apiUrl,
            @Value("${WORKOS_API_KEY}") String apiKey) {
        this.apiKey = apiKey;
        this.client = builder.baseUrl(apiUrl)
                .defaultHeaders(headers -> headers.setBearerAuth(apiKey))
                .defaultStatusHandler(status -> status.isError(), (request, response) -> {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "WorkOS request failed");
                })
                .build();
    }

    public List<Organization> getOrganizations() {
        return list("/organizations", null, new ParameterizedTypeReference<Page<Organization>>() {});
    }

    public List<Role> getOrganizationRoles(String organizationId) {
        requireConfigured();
        var page = client.get()
                .uri("/authorization/organizations/{id}/roles", organizationId)
                .retrieve()
                .body(new ParameterizedTypeReference<Page<Role>>() {});
        return requirePage(page).data();
    }

    public List<AdminUserResponse> getMembers(String organizationId) {
        var memberships = list(
                "/user_management/organization_memberships",
                organizationId,
                new ParameterizedTypeReference<Page<Membership>>() {});
        return memberships.stream()
                .map(membership -> {
                    var user = client.get()
                            .uri("/user_management/users/{id}", membership.userId())
                            .retrieve()
                            .body(User.class);
                    if (user == null) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Missing WorkOS user");
                    String name = ((user.firstName() == null ? "" : user.firstName()) + " "
                                    + (user.lastName() == null ? "" : user.lastName()))
                            .trim();
                    var roles = membership.roles() != null
                            ? membership.roles()
                            : membership.role() == null ? List.<MembershipRole>of() : List.of(membership.role());
                    return new AdminUserResponse(
                            membership.id(),
                            membership.userId(),
                            name.isEmpty() ? user.email() : name,
                            user.email(),
                            membership.createdAt(),
                            roles.stream().map(MembershipRole::slug).toList());
                })
                .toList();
    }

    public UserRoles updateRole(String membershipId, UserRoles request) {
        requireConfigured();
        if (request.roleSlugs() == null
                || request.roleSlugs().isEmpty()
                || request.roleSlugs().stream().anyMatch(role -> role == null || role.isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one role is required");
        }

        client.put()
                .uri("/user_management/organization_memberships/{id}", membershipId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new RoleUpdate(request.roleSlugs()))
                .retrieve()
                .toBodilessEntity();
        return request;
    }

    private <T> List<T> list(String path, String organizationId, ParameterizedTypeReference<Page<T>> type) {
        requireConfigured();
        var items = new ArrayList<T>();
        String after = null;
        do {
            final String cursor = after;
            var page = requirePage(client.get()
                    .uri(uri -> {
                        var builder = uri.path(path).queryParam("limit", 100);
                        if (organizationId != null) builder.queryParam("organization_id", organizationId);
                        if (cursor != null) builder.queryParam("after", cursor);
                        return builder.build();
                    })
                    .retrieve()
                    .body(type));
            items.addAll(page.data());
            after = page.metadata() == null ? null : page.metadata().after();
        } while (after != null && !after.isBlank());
        return items;
    }

    private static <T> Page<T> requirePage(Page<T> page) {
        if (page == null || page.data() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid WorkOS response");
        }
        return page;
    }

    private void requireConfigured() {
        if (apiKey.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "WorkOS is not configured");
    }

    record Page<T>(
            List<T> data, @JsonProperty("list_metadata") Metadata metadata) {}

    record Metadata(String after) {}

    record Membership(
            String id,
            @JsonProperty("user_id") String userId,
            @JsonProperty("created_at") String createdAt,
            MembershipRole role,
            List<MembershipRole> roles) {}

    record MembershipRole(String slug) {}

    record User(
            String email,
            @JsonProperty("first_name") String firstName,
            @JsonProperty("last_name") String lastName) {}

    record RoleUpdate(@JsonProperty("role_slugs") List<String> roleSlugs) {}
}
