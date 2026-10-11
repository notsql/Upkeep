package com.proj.server.admin;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.UserRoles;
import com.proj.server.workos.WorkOSService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@WebMvcTest(controllers = AdminController.class)
class AdminControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    WorkOSService service;

    @Test
    void identifiesTheAuthenticatedAdminDuringARoleUpdate() throws Exception {
        var roles = new UserRoles(List.of("member"));
        when(service.updateRole("user_self", "om_test", roles)).thenReturn(roles);

        mvc.perform(put("/api/admin/users/om_test/role")
                        .with(jwt().jwt(token -> token.subject("user_self")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleSlugs\":[\"member\"]}"))
                .andExpect(status().isOk());

        verify(service).updateRole("user_self", "om_test", roles);
    }

    @Test
    void returnsTheRoleSafeguardReason() throws Exception {
        var roles = new UserRoles(List.of("member"));
        when(service.updateRole("user_self", "om_test", roles))
                .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "You cannot remove your own admin role."));

        mvc.perform(put("/api/admin/users/om_test/role")
                        .with(jwt().jwt(token -> token.subject("user_self")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleSlugs\":[\"member\"]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You cannot remove your own admin role."));
    }
}
