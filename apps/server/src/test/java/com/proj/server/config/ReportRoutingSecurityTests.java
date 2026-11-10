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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

/** Filter-chain coverage for ID-70; work-order authority is exercised by the database tests. */
@WebMvcTest(
        controllers = ReportRoutingSecurityTests.RoutingEndpoints.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, ReportRoutingSecurityTests.RoutingEndpoints.class})
class ReportRoutingSecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    JwtDecoder decoder;

    @ParameterizedTest
    @CsvSource({
        "GET, /estates/estate/contractors",
        "PUT, /estates/estate/contractors/LIFT",
        "DELETE, /estates/estate/contractors/LIFT",
        "POST, /estates/estate/reports/report/work-order",
        "POST, /estates/estate/reports/report/dismiss",
        "GET, /estates/estate/work-orders/order/dispatch",
        "POST, /estates/estate/work-orders/order/dispatch",
        "POST, /estates/estate/work-orders/order/dispatch/retry"
    })
    void authenticatedIdentityReachesBusinessAuthorizationRegardlessOfWorkosRole(String method, String path)
            throws Exception {
        for (var role : List.of("user", "resident", "admin")) {
            mvc.perform(request(HttpMethod.valueOf(method), path)
                            .with(jwt().jwt(token -> token.subject("staff").claim("role", role))
                                    .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isOk())
                    .andExpect(content().string("routing business authorization"));
        }
    }

    @ParameterizedTest
    @CsvSource({
        "GET, /estates/estate/contractors",
        "PUT, /estates/estate/contractors/LIFT",
        "DELETE, /estates/estate/contractors/LIFT",
        "POST, /estates/estate/reports/report/work-order",
        "POST, /estates/estate/reports/report/dismiss",
        "GET, /estates/estate/work-orders/order/dispatch",
        "POST, /estates/estate/work-orders/order/dispatch",
        "POST, /estates/estate/work-orders/order/dispatch/retry"
    })
    void workOrderOperationsRequireAuthentication(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({
        "POST, /estates/estate/contractors",
        "GET, /estates/estate/contractors/LIFT",
        "PATCH, /estates/estate/contractors/LIFT",
        "GET, /estates/estate/reports/report/work-order",
        "PUT, /estates/estate/reports/report/work-order",
        "DELETE, /estates/estate/reports/report/work-order",
        "PUT, /estates/estate/work-orders/order/dispatch",
        "DELETE, /estates/estate/work-orders/order/dispatch",
        "GET, /estates/estate/work-orders/order/dispatch/retry",
        "POST, /resident/reports/report/work-order"
    })
    void unspecifiedWorkOrderOperationsRemainDenied(String method, String path) throws Exception {
        mvc.perform(request(HttpMethod.valueOf(method), path).with(jwt())).andExpect(status().isForbidden());
    }

    @RestController
    static class RoutingEndpoints {
        @GetMapping({"/estates/{estateId}/contractors", "/estates/{estateId}/work-orders/{workOrderId}/dispatch"})
        String list() {
            return "routing business authorization";
        }

        @PutMapping("/estates/{estateId}/contractors/{equipmentType}")
        String save() {
            return "routing business authorization";
        }

        @DeleteMapping("/estates/{estateId}/contractors/{equipmentType}")
        String remove() {
            return "routing business authorization";
        }

        @PostMapping({
            "/estates/{estateId}/reports/{reportId}/work-order",
            "/estates/{estateId}/reports/{reportId}/dismiss",
            "/estates/{estateId}/work-orders/{workOrderId}/dispatch",
            "/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry"
        })
        String act() {
            return "routing business authorization";
        }
    }
}
