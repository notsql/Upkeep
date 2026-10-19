package com.proj.server.config;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    void acceptsValidJwtForAccessContext() throws Exception {
        mockMvc.perform(get("/access/context").with(jwt().jwt(token -> token.subject("user_123"))))
                .andExpect(status().isOk())
                .andExpect(content().string("business"));
    }

    @Test
    void rejectsInvalidBearerToken() throws Exception {
        when(jwtDecoder.decode("invalid")).thenThrow(new BadJwtException("Invalid token"));

        mockMvc.perform(get("/test/protected").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reportHistoryRequiresAuthenticationRatherThanAWorkosResidentRole() throws Exception {
        mockMvc.perform(get("/resident/reports")).andExpect(status().isUnauthorized());
        for (var role : List.of("user", "resident", "admin")) {
            mockMvc.perform(get("/resident/reports")
                            .with(jwt().jwt(token -> token.claim("role", role))
                                    .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void accessContextIsReachableBeforeTheEstateRoleIsKnown() throws Exception {
        mockMvc.perform(get("/access/context")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/access/context").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_user"))))
                .andExpect(status().isOk());
    }

    static Stream<Arguments> restoredOperations() {
        return Stream.of(
                Arguments.of("GET", "/asset-categories"),
                Arguments.of("GET", "/manufacturers"),
                Arguments.of("GET", "/manufacturers/manufacturer/models"),
                Arguments.of("GET", "/estates/estate/assets/asset/events"),
                Arguments.of("POST", "/estates/estate/assets/asset/events"),
                Arguments.of("POST", "/estates/estate/assets/asset/devices/device/credential"),
                Arguments.of("GET", "/estates/estate/assets/asset/failure-risk"),
                Arguments.of("GET", "/estates/estate/failure-risk"),
                Arguments.of("POST", "/estates/estate/assets/asset/readings/anomaly-check"));
    }

    @ParameterizedTest
    @MethodSource("restoredOperations")
    void authenticatedCallersReachExistingOperations(String method, String path) throws Exception {
        for (var role : List.of("user", "resident", "admin")) {
            mockMvc.perform(request(HttpMethod.valueOf(method), path)
                            .with(jwt().jwt(token -> token.subject("user_123").claim("role", role))
                                    .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isOk())
                    .andExpect(content().string("business"));
        }
    }

    @ParameterizedTest
    @MethodSource("restoredOperations")
    void existingOperationsRequireAuthentication(String method, String path) throws Exception {
        mockMvc.perform(request(HttpMethod.valueOf(method), path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @MethodSource("restoredOperations")
    void existingOperationsRejectInvalidTokens(String method, String path) throws Exception {
        when(jwtDecoder.decode("invalid")).thenThrow(new BadJwtException("Invalid token"));
        mockMvc.perform(request(HttpMethod.valueOf(method), path).header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({
        "POST, /asset-categories",
        "POST, /manufacturers",
        "POST, /manufacturers/manufacturer/models",
        "DELETE, /estates/estate/assets/asset/events",
        "POST, /estates/estate/assets/asset/failure-risk",
        "POST, /estates/estate/failure-risk",
        "GET, /estates/estate/assets/asset/readings/anomaly-check",
        "GET, /estates/estate/assets/asset/devices/device/credential",
        "DELETE, /estates/estate/assets/asset/devices/device/credential",
        "POST, /estates/estate/assets/asset/devices/device/credential/future-action",
        "GET, /estates/estate/assets/asset/events/future-action",
        "GET, /manufacturers/manufacturer/models/future-action"
    })
    void rejectsUnlistedMethodsAndNestedActions(String method, String path) throws Exception {
        for (var role : List.of("user", "resident", "admin")) {
            mockMvc.perform(request(HttpMethod.valueOf(method), path)
                            .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void rejectsUnlistedBusinessActionsRegardlessOfJwtRole() throws Exception {
        for (var role : List.of("user", "resident", "admin")) {
            var token = jwt().jwt(value -> value.claim("role", role))
                    .authorities(new SimpleGrantedAuthority("ROLE_" + role));
            mockMvc.perform(get("/test/future-business").with(token)).andExpect(status().isForbidden());
            mockMvc.perform(delete("/resident/reports/00000000-0000-0000-0000-000000000001")
                            .with(token))
                    .andExpect(status().isForbidden());
        }
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

        @GetMapping({
            "/access/context",
            "/resident/context",
            "/resident/locations",
            "/resident/reports",
            "/resident/reports/{reportId}",
            "/resident/reports/{reportId}/images/{imageId}",
            "/estates",
            "/dashboard/summary",
            "/asset-categories",
            "/manufacturers",
            "/manufacturers/{manufacturerId}/models",
            "/estates/{estateId}/assets/{assetId}/events",
            "/estates/{estateId}/assets/{assetId}/failure-risk",
            "/estates/{estateId}/failure-risk",
            "/test/future-business"
        })
        String businessEndpoint() {
            return "business";
        }

        @PostMapping({
            "/estates/{estateId}/assets/{assetId}/events",
            "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential",
            "/estates/{estateId}/assets/{assetId}/readings/anomaly-check"
        })
        String assetOperation() {
            return "business";
        }

        @PostMapping("/resident/reports")
        String createReport() {
            return "created";
        }

        @DeleteMapping("/resident/reports/{reportId}")
        String deleteReport() {
            return "deleted";
        }
    }
}
