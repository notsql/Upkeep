package com.proj.server.workos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.workos.WorkOS;
import com.workos.common.exceptions.TransportException;
import com.workos.organizationmembership.CreateUserRole;
import com.workos.organizationmembership.OrganizationMembershipService;
import java.util.List;
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
}
