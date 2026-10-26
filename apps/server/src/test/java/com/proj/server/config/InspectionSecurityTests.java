package com.proj.server.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Only filter-chain routing is stubbed here; real estate authorization lives in integration tests. */
@WebMvcTest(
        controllers = InspectionSecurityTests.Endpoints.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, InspectionSecurityTests.Endpoints.class})
class InspectionSecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    JwtDecoder decoder;

    @ParameterizedTest
    @CsvSource({
        "GET, /estates/e/inspection-assets",
        "GET, /estates/e/inspection-assets/a",
        "GET, /estates/e/assets/a/inspections",
        "GET, /estates/e/assets/a/inspections/i",
        "GET, /estates/e/assets/a/inspections/i/photos/p",
        "POST, /estates/e/assets/a/inspections"
    })
    void authenticatedOperationsReachEstateAuthorizationRegardlessOfProviderRole(String method, String path)
            throws Exception {
        for (String role : new String[] {"user", "resident", "admin"}) {
            mvc.perform(request(HttpMethod.valueOf(method), path)
                            .with(jwt().jwt(t -> t.subject("inspector").claim("role", role))
                                    .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isOk())
                    .andExpect(content().string("inspection authorization"));
        }
    }

    @ParameterizedTest
    @CsvSource({
        "GET, /estates/e/inspection-assets",
        "GET, /estates/e/inspection-assets/a",
        "GET, /estates/e/assets/a/inspections",
        "GET, /estates/e/assets/a/inspections/i",
        "GET, /estates/e/assets/a/inspections/i/photos/p",
        "POST, /estates/e/assets/a/inspections"
    })
    void allInspectionOperationsRequireIdentity(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({
        "POST, /estates/e/inspection-assets",
        "POST, /estates/e/inspection-assets/a",
        "PUT, /estates/e/assets/a/inspections",
        "PATCH, /estates/e/assets/a/inspections/i",
        "PUT, /estates/e/assets/a/inspections/i",
        "DELETE, /estates/e/assets/a/inspections/i",
        "POST, /estates/e/assets/a/inspections/i/photos",
        "DELETE, /estates/e/assets/a/inspections/i/photos/p",
        "GET, /estates/e/assets/a/inspections/i/future-action",
        "GET, /estates/e/assets/a/inspections/i/photos/p/future-action"
    })
    void appendOnlyEvidenceAndUnspecifiedActionsRemainDenied(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(jwt())).andExpect(status().isForbidden());
    }

    @RestController
    static class Endpoints {
        @GetMapping({
            "/estates/{estateId}/inspection-assets",
            "/estates/{estateId}/inspection-assets/{assetId}",
            "/estates/{estateId}/assets/{assetId}/inspections",
            "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}",
            "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}"
        })
        String read() {
            return "inspection authorization";
        }

        @PostMapping("/estates/{estateId}/assets/{assetId}/inspections")
        String save() {
            return "inspection authorization";
        }
    }
}
