package com.proj.server.estate;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.config.SecurityConfig;
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
    void providerAdminsCannotListAllEstatesOrChangeMembershipThroughRetiredGrants() throws Exception {
        mvc.perform(get(path).with(admin())).andExpect(status().isForbidden());
        mvc.perform(put(path + "/" + estateId).with(admin())).andExpect(status().isForbidden());
        mvc.perform(delete(path + "/" + estateId).with(admin())).andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(repository);
    }
}
