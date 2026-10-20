package com.proj.server.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RestController;

/** Filter-chain coverage; estate authorization is exercised by the database tests. */
@WebMvcTest(
        controllers = FaultReportSecurityTests.ReportEndpoints.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, FaultReportSecurityTests.ReportEndpoints.class})
class FaultReportSecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    JwtDecoder decoder;

    @ParameterizedTest
    @CsvSource({
        "GET, /estates/estate/reports",
        "GET, /estates/estate/reports/report",
        "GET, /estates/estate/reports/report/images/image",
        "PATCH, /estates/estate/reports/report/location"
    })
    void authenticatedIdentityReachesBusinessAuthorizationRegardlessOfWorkosRole(String method, String path)
            throws Exception {
        for (var role : List.of("user", "resident", "admin")) {
            mvc.perform(request(HttpMethod.valueOf(method), path)
                            .with(jwt().jwt(token -> token.subject("staff").claim("role", role))
                                    .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isOk())
                    .andExpect(content().string("report business authorization"));
        }
    }

    @ParameterizedTest
    @CsvSource({
        "GET, /estates/estate/reports",
        "GET, /estates/estate/reports/report",
        "GET, /estates/estate/reports/report/images/image",
        "PATCH, /estates/estate/reports/report/location"
    })
    void reportOperationsRequireAuthentication(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({
        "POST, /estates/estate/reports",
        "PATCH, /estates/estate/reports/report",
        "DELETE, /estates/estate/reports/report",
        "PUT, /estates/estate/reports/report/location",
        "POST, /estates/estate/reports/report/location",
        "GET, /estates/estate/reports/report/location",
        "DELETE, /estates/estate/reports/report/images/image",
        "GET, /estates/estate/reports/report/future-action",
        "GET, /estates/estate/reports/report/images/image/future-action",
        "PATCH, /resident/reports/report/location"
    })
    void unspecifiedReportWritesAndNestedActionsRemainDenied(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(jwt())).andExpect(status().isForbidden());
    }

    @RestController
    static class ReportEndpoints {
        @GetMapping({
            "/estates/{estateId}/reports",
            "/estates/{estateId}/reports/{reportId}",
            "/estates/{estateId}/reports/{reportId}/images/{imageId}"
        })
        String read() {
            return "report business authorization";
        }

        @PatchMapping("/estates/{estateId}/reports/{reportId}/location")
        String relocate() {
            return "report business authorization";
        }
    }
}
