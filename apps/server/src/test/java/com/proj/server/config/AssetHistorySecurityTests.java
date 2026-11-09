package com.proj.server.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Filter routing only; real Owner/Council authorization is exercised against Postgres. */
@WebMvcTest(
        controllers = AssetHistorySecurityTests.Endpoints.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, AssetHistorySecurityTests.Endpoints.class})
class AssetHistorySecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    JwtDecoder decoder;

    @ParameterizedTest
    @CsvSource({
        "/estates/e/asset-history, user",
        "/estates/e/asset-history, resident",
        "/estates/e/asset-history, admin",
        "/estates/e/assets/a/history, user",
        "/estates/e/assets/a/history, resident",
        "/estates/e/assets/a/history, admin"
    })
    void historyReadsReachLiveEstateAuthorizationRegardlessOfProviderRole(String path, String role) throws Exception {
        mvc.perform(get(path)
                        .with(jwt().jwt(t -> t.subject("reader").claim("role", role))
                                .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                .andExpect(status().isOk())
                .andExpect(content().string("history authorization"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/estates/e/asset-history", "/estates/e/assets/a/history"})
    void historyReadsRequireIdentity(String path) throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({
        "POST, /estates/e/asset-history",
        "PUT, /estates/e/asset-history",
        "PATCH, /estates/e/asset-history",
        "DELETE, /estates/e/asset-history",
        "POST, /estates/e/assets/a/history",
        "PUT, /estates/e/assets/a/history",
        "PATCH, /estates/e/assets/a/history",
        "DELETE, /estates/e/assets/a/history",
        "GET, /estates/e/assets/a/history/future-action",
        "GET, /estates/e/asset-history/future-action"
    })
    void historyDoesNotAuthorizeWritesOrUnspecifiedSubpaths(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(jwt())).andExpect(status().isForbidden());
    }

    @RestController
    static class Endpoints {
        @GetMapping({"/estates/{estateId}/asset-history", "/estates/{estateId}/assets/{assetId}/history"})
        String read() {
            return "history authorization";
        }
    }
}
