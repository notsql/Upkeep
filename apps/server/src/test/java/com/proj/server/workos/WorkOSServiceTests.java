package com.proj.server.workos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.workos.WorkOS;
import com.workos.common.exceptions.TransportException;
import com.workos.common.http.Page;
import com.workos.models.OrganizationMembership;
import com.workos.models.SlimRole;
import com.workos.models.User;
import com.workos.organizationmembership.CreateUserRole;
import com.workos.organizationmembership.OrganizationMembershipService;
import com.workos.types.OrganizationMembershipStatus;
import com.workos.usermanagement.UserManagement;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.PropertyPlaceholderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class WorkOSServiceTests {
    private final WorkOS client = mock(WorkOS.class);
    private final OrganizationMembershipService memberships = mock(OrganizationMembershipService.class);
    private final WorkOSService service = new WorkOSService("test-key", client);

    @BeforeEach
    void setUp() {
        when(client.getOrganizationMembership()).thenReturn(memberships);
    }

    @Test
    void updatesTheOrganizationMembershipRole() {
        var result = service.updateRole("user_actor", "om_test", new UserRoles(List.of("admin")));

        assertEquals(List.of("admin"), result.roleSlugs());
        verify(memberships).update("om_test", new CreateUserRole.Multiple(List.of("admin")));
    }

    @Test
    void rejectsMultipleWorkosRolesBeforeCallingWorkos() {
        var exception = assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_actor", "om_test", new UserRoles(List.of("resident", "admin"))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        verifyNoInteractions(memberships);
    }

    @Test
    void reportsWhenTheRoleUpdateFails() {
        when(memberships.update("om_test", new CreateUserRole.Multiple(List.of("admin"))))
                .thenThrow(new TransportException("request failed", new RuntimeException("boom")));

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_actor", "om_test", new UserRoles(List.of("admin"))));

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatusCode());
        assertEquals("WorkOS request failed", exception.getReason());
    }

    @Test
    void rejectsRemovingTheLastAdmin() {
        var current = membership("om_test", "admin");
        organizationMembers(current, List.of(current));

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_actor", "om_test", new UserRoles(List.of("member"))));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals("Estate must have at least 1 admin.", exception.getReason());
        verify(memberships, never()).update(anyString(), any(CreateUserRole.class));
    }

    @Test
    void rejectsRemovingTheAuthenticatedAdminsOwnRole() {
        var current = membership("om_test", "admin");
        when(current.getUserId()).thenReturn("user_self");
        organizationMembers(current, List.of(current, membership("om_other", "admin")));

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_self", "om_test", new UserRoles(List.of("member"))));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals("You cannot remove your own admin role.", exception.getReason());
        verify(memberships, never()).update(anyString(), any(CreateUserRole.class));
    }

    @Test
    void reportsSelfDemotionBeforeTheLastAdminSafeguard() {
        var current = membership("om_test", "admin");
        when(current.getUserId()).thenReturn("user_self");
        organizationMembers(current, List.of(current));

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_self", "om_test", new UserRoles(List.of("member"))));

        assertEquals("You cannot remove your own admin role.", exception.getReason());
    }

    @Test
    void allowsDemotionWhenAnotherAdminRemains() {
        var current = membership("om_test", "admin");
        var other = membership("om_other", "admin");
        when(other.getRoles()).thenReturn(null);
        organizationMembers(current, List.of(current, other));

        assertEquals(
                List.of("member"),
                service.updateRole("user_actor", "om_test", new UserRoles(List.of("member")))
                        .roleSlugs());
        verify(memberships).update("om_test", new CreateUserRole.Multiple(List.of("member")));
    }

    @Test
    void doesNotCountInactiveOrForeignAdmins() {
        var current = membership("om_test", "admin");
        var inactive = membership("om_inactive", "admin");
        when(inactive.getStatus()).thenReturn(OrganizationMembershipStatus.Inactive);
        var foreign = membership("om_foreign", "admin");
        when(foreign.getOrganizationId()).thenReturn("org_other");
        organizationMembers(current, List.of(current, inactive, foreign));

        assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_actor", "om_test", new UserRoles(List.of("member"))));
        verify(memberships, never()).update(anyString(), any(CreateUserRole.class));
    }

    @Test
    void doesNotUpdateWhenAdminLookupFails() {
        when(memberships.get("om_test"))
                .thenThrow(new TransportException("request failed", new RuntimeException("boom")));

        var exception = assertThrows(
                ResponseStatusException.class,
                () -> service.updateRole("user_actor", "om_test", new UserRoles(List.of("member"))));

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatusCode());
        verify(memberships, never()).update(anyString(), any(CreateUserRole.class));
    }

    @Test
    void allowsChangingANonAdminWhenNoAdminIsReturned() {
        var current = membership("om_test", "viewer");
        organizationMembers(current, List.of(current));

        assertEquals(
                List.of("member"),
                service.updateRole("user_actor", "om_test", new UserRoles(List.of("member")))
                        .roleSlugs());
        verify(memberships).update("om_test", new CreateUserRole.Multiple(List.of("member")));
    }

    private OrganizationMembership membership(String id, String slug) {
        var membership = mock(OrganizationMembership.class);
        var role = mock(SlimRole.class);
        when(role.getSlug()).thenReturn(slug);
        when(membership.getId()).thenReturn(id);
        when(membership.getOrganizationId()).thenReturn("org_test");
        when(membership.getStatus()).thenReturn(OrganizationMembershipStatus.Active);
        when(membership.getRole()).thenReturn(role);
        when(membership.getRoles()).thenReturn(List.of(role));
        return membership;
    }

    @SuppressWarnings("unchecked")
    private void organizationMembers(OrganizationMembership current, List<OrganizationMembership> members) {
        when(memberships.get("om_test")).thenReturn(current);
        Page<OrganizationMembership> page = mock(Page.class);
        when(memberships.list(null, null, 100, null, "org_test")).thenReturn(page);
        when(page.autoPagingIterable()).thenReturn(members);
    }

    private User user(String firstName, String lastName, String email) {
        var user = mock(User.class);
        when(user.getFirstName()).thenReturn(firstName);
        when(user.getLastName()).thenReturn(lastName);
        when(user.getEmail()).thenReturn(email);
        return user;
    }

    @Test
    void namesAUserForDisplay() {
        var users = mock(UserManagement.class);
        when(client.getUserManagement()).thenReturn(users);
        var casey = user("Casey", "Doe", "casey@example.com");
        when(users.get("user_1")).thenReturn(casey);

        assertEquals(Optional.of("Casey Doe"), service.findDisplayName("user_1"));
    }

    @Test
    void namesAUserWithoutANameByEmail() {
        var users = mock(UserManagement.class);
        when(client.getUserManagement()).thenReturn(users);
        var unnamed = user(null, null, "casey@example.com");
        when(users.get("user_1")).thenReturn(unnamed);

        assertEquals(Optional.of("casey@example.com"), service.findDisplayName("user_1"));
    }

    @Test
    void givesNoNameWhenWorkOSFailsOrIsNotConfigured() {
        var users = mock(UserManagement.class);
        when(client.getUserManagement()).thenReturn(users);
        when(users.get("user_1")).thenThrow(new TransportException("request failed", new RuntimeException("boom")));

        assertEquals(Optional.empty(), service.findDisplayName("user_1"));
        assertEquals(Optional.empty(), new WorkOSService("", client).findDisplayName("user_1"));
    }

    @Test
    void startsUnconfiguredWhenTheApiKeyIsBlank() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(PropertyPlaceholderAutoConfiguration.class))
                .withPropertyValues("app.workos.api-key=")
                .withUserConfiguration(WorkOSService.class)
                .run(context -> {
                    assertNull(context.getStartupFailure());

                    var exception =
                            assertThrows(ResponseStatusException.class, () -> context.getBean(WorkOSService.class)
                                    .getOrganizations());
                    assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
                });
    }
}
