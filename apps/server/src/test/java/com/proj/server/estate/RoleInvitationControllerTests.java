package com.proj.server.estate;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.config.SecurityConfig;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = CouncilController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, EstateExceptionHandler.class})
class RoleInvitationControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    CouncilService service;

    @MockitoBean
    JwtDecoder decoder;

    @org.junit.jupiter.api.Test
    void providerAdminClaimsCannotBypassEstateInvitationsOrManageProviderRoles() throws Exception {
        var admin = jwt().jwt(token -> token.subject("unassigned"))
                .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_admin"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                                "/api/admin/users/recipient/estates/" + UUID.randomUUID())
                        .with(admin))
                .andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                                "/api/admin/users/membership/role")
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleSlugs\":[\"admin\"]}"))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "\"OWNER\"", "\"ADMIN\"", "\"MEMBER\"", "\"admin\"", "\"unknown\""})
    void rejectsInvalidInvitationRoles(String role) throws Exception {
        mvc.perform(post("/estates/" + UUID.randomUUID() + "/council-invitations")
                        .with(jwt().jwt(token -> token.subject("manager")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"recipient@example.com\",\"role\":" + role + "}"))
                .andExpect(status().isBadRequest());
    }
}
