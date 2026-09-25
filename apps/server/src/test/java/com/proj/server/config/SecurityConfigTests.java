package com.proj.server.config;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(
        controllers = SecurityConfigTests.TestController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "spring.security.oauth2.resourceserver.jwt.audiences[0]=https://api.example.com"
        })
@Import({SecurityConfig.class, SecurityConfigTests.TestController.class})
class SecurityConfigTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void leavesHealthEndpointPublic() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    void rejectsMissingBearerTokenForProtectedEndpoint() throws Exception {
        mockMvc.perform(get("/test/protected")).andExpect(status().isUnauthorized());
    }

    @Test
    void acceptsValidJwtForProtectedEndpoint() throws Exception {
        mockMvc.perform(get("/test/protected").with(jwt().jwt(token -> token.subject("user_123"))))
                .andExpect(status().isOk())
                .andExpect(content().string("protected"));
    }

    @Test
    void rejectsInvalidBearerToken() throws Exception {
        when(jwtDecoder.decode("invalid")).thenThrow(new BadJwtException("Invalid token"));

        mockMvc.perform(get("/test/protected").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
    }

    @RestController
    static class TestController {

        @GetMapping("/health")
        String health() {
            return "ok";
        }

        @GetMapping("/test/protected")
        String protectedEndpoint() {
            return "protected";
        }
    }
}
