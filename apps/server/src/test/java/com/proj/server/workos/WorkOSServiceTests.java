package com.proj.server.workos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

class WorkOSServiceTests {
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server =
            MockRestServiceServer.bindTo(builder).build();
    private final WorkOSService service = new WorkOSService("test-key");

    @Test
    void updatesTheOrganizationMembershipRole() {
        server.expect(requestTo("https://api.workos.com/user_management/organization_memberships/om_test"))
                .andExpect(method(HttpMethod.PUT))
                .andExpect(content().json("{\"role_slugs\":[\"admin\"]}"))
                .andRespond(withSuccess());

        var result = service.updateRole("om_test", new UserRoles(List.of("admin")));

        assertEquals(List.of("admin"), result.roleSlugs());
        server.verify();
    }

    @Test
    void reportsWhenTheRoleUpdateFails() {
        server.expect(requestTo("https://api.workos.com/user_management/organization_memberships/om_test"))
                .andExpect(method(HttpMethod.PUT))
                .andRespond(withServerError());

        assertThrows(
                ResponseStatusException.class, () -> service.updateRole("om_test", new UserRoles(List.of("admin"))));
        server.verify();
    }
}
