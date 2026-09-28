package com.proj.server.estate;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.config.SecurityConfig;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = EstateUserController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, EstateUserService.class, EstateExceptionHandler.class})
class EstateUserControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    EstateUserRepository repository;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID estateId = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");
    private final String path = "/api/admin/users/user_1/estates";

    private static JwtRequestPostProcessor admin() {
        return jwt().jwt(t -> t.subject("admin_1")).authorities(new SimpleGrantedAuthority("ROLE_admin"));
    }

    @Test
    void requiresTheAdminRole() throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("member_1")))).andExpect(status().isForbidden());
        mvc.perform(put(path + "/" + estateId).with(jwt().jwt(t -> t.subject("member_1"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete(path + "/" + estateId).with(jwt().jwt(t -> t.subject("member_1"))))
                .andExpect(status().isForbidden());
        verify(repository, never()).add(estateId, "user_1");
        verify(repository, never()).remove(estateId, "user_1");
    }

    @Test
    void listsEveryEstateWithTheUsersAccess() throws Exception {
        when(repository.listForUser("user_1"))
                .thenReturn(List.of(
                        new EstateUserResponse(estateId, "Maple Grove", "MG-001", true, false, true),
                        new EstateUserResponse(UUID.randomUUID(), "Oak Park", "OP-001", false, true, false)));
        mvc.perform(get(path).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].estateId").value(estateId.toString()))
                .andExpect(jsonPath("$[0].granted").value(true))
                .andExpect(jsonPath("$[1].owner").value(true))
                .andExpect(jsonPath("$[1].active").value(false));
    }

    @Test
    void addsAUserToAnExistingEstate() throws Exception {
        when(repository.estateExists(estateId)).thenReturn(true);
        mvc.perform(put(path + "/" + estateId).with(admin())).andExpect(status().isNoContent());
        verify(repository).add(estateId, "user_1");
    }

    @Test
    void rejectsAddingAUserToAnUnknownEstate() throws Exception {
        when(repository.estateExists(estateId)).thenReturn(false);
        mvc.perform(put(path + "/" + estateId).with(admin()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Estate not found."));
        verify(repository, never()).add(estateId, "user_1");
    }

    @Test
    void removesAUserFromAnEstate() throws Exception {
        mvc.perform(delete(path + "/" + estateId).with(admin())).andExpect(status().isNoContent());
        verify(repository).remove(estateId, "user_1");
    }
}
