package com.proj.server.workos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.workos.WorkOS;
import com.workos.common.exceptions.TransportException;
import com.workos.models.User;
import com.workos.organizationmembership.CreateUserRole;
import com.workos.organizationmembership.OrganizationMembershipService;
import com.workos.usermanagement.UserManagement;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
        var result = service.updateRole("om_test", new UserRoles(List.of("admin")));

        assertEquals(List.of("admin"), result.roleSlugs());
        verify(memberships).update("om_test", new CreateUserRole.Multiple(List.of("admin")));
    }

    @Test
    void reportsWhenTheRoleUpdateFails() {
        when(memberships.update("om_test", new CreateUserRole.Multiple(List.of("admin"))))
                .thenThrow(new TransportException("request failed", new RuntimeException("boom")));

        var exception = assertThrows(
                ResponseStatusException.class, () -> service.updateRole("om_test", new UserRoles(List.of("admin"))));

        assertEquals(HttpStatus.BAD_GATEWAY, exception.getStatusCode());
        assertEquals("WorkOS request failed", exception.getReason());
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
}
