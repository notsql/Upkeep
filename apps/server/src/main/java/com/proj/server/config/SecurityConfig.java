package com.proj.server.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * The browser calls this API directly (no BFF proxy), so CORS is configured
 * here and the API is stateless - every request carries its own bearer token.
 *
 * <p>JWT validation only switches on when
 * {@code spring.security.oauth2.resourceserver.jwt.issuer-uri} is set, so the
 * app runs locally without a WorkOS tenant and production becomes a config
 * change rather than a code change. WorkOS AuthKit issues standard OIDC
 * tokens, so Spring discovers the JWKS from the issuer on its own. Spring Boot
 * also validates the audience when
 * {@code spring.security.oauth2.resourceserver.jwt.audiences} is configured.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Endpoints that must stay reachable without a token. */
    private static final String[] PUBLIC_PATHS = {
        "/v3/api-docs", "/v3/api-docs/**", "/swagger-ui", "/swagger-ui/**", "/actuator/health", "/health"
    };

    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}")
    private String issuer;

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (issuer.isBlank()) {
            // Local development: no identity provider configured.
            http.authorizeHttpRequests(
                    auth -> auth.requestMatchers("/api/admin/users", "/api/admin/users/**", "/users", "/users/**")
                            .denyAll()
                            .anyRequest()
                            .permitAll());
            return http.build();
        }

        http.authorizeHttpRequests(auth -> auth.requestMatchers(PUBLIC_PATHS)
                        .permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                        .permitAll()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/resident/context",
                                "/resident/locations",
                                "/resident/reports",
                                "/resident/reports/{reportId}",
                                "/resident/reports/{reportId}/images/{imageId}")
                        .authenticated()
                        .requestMatchers(HttpMethod.POST, "/resident/reports")
                        .authenticated()
                        .requestMatchers("/resident/**")
                        .denyAll()
                        .requestMatchers("/users", "/users/**", "/api/admin/users", "/api/admin/users/**")
                        .denyAll()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/access/context",
                                "/estates/{estateId}/documents",
                                "/estates/{estateId}/documents/{documentId}/content",
                                "/estates/{estateId}/documents/{documentId}/work-order",
                                "/estates/{estateId}/documents/{documentId}/work-order/history",
                                "/estates/{estateId}/work-orders/{workOrderId}/documents",
                                "/asset-categories",
                                "/manufacturers",
                                "/manufacturers/{manufacturerId}/models",
                                "/estates",
                                "/dashboard/summary",
                                "/council-invitations",
                                "/estates/{estateId}",
                                "/estates/{estateId}/locations",
                                "/estates/{estateId}/reports",
                                "/estates/{estateId}/work-orders",
                                "/estates/{estateId}/work-orders/{workOrderId}",
                                "/estates/{estateId}/work-orders/{workOrderId}/status-history",
                                "/estates/{estateId}/work-orders/{workOrderId}/completion-revisions",
                                "/estates/{estateId}/assets/{assetId}/work-order-completions",
                                "/estates/{estateId}/work-order-assets",
                                "/estates/{estateId}/inspection-assets",
                                "/estates/{estateId}/inspection-assets/{assetId}",
                                "/estates/{estateId}/inspection-results/{inspectionId}",
                                "/estates/{estateId}/assets/{assetId}/inspections",
                                "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}",
                                "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}",
                                "/estates/{estateId}/reports/{reportId}",
                                "/estates/{estateId}/reports/{reportId}/images/{imageId}",
                                "/estates/{estateId}/assets",
                                "/estates/{estateId}/assets/{id}",
                                "/estates/{estateId}/assets/{id}/lifecycle-events",
                                "/estates/{estateId}/assets/{assetId}/devices",
                                "/estates/{estateId}/assets/{assetId}/assessments",
                                "/estates/{estateId}/assets/{assetId}/events",
                                "/estates/{estateId}/assets/{assetId}/readings",
                                "/estates/{estateId}/assets/{assetId}/failure-risk",
                                "/estates/{estateId}/devices",
                                "/estates/{estateId}/failure-risk",
                                "/estates/{estateId}/flatline-policies",
                                "/estates/{estateId}/flatlined-sensors",
                                "/estates/{estateId}/members",
                                "/estates/{estateId}/roles",
                                "/estates/{estateId}/role-permissions",
                                "/estates/{estateId}/invitation-roles",
                                "/estates/{estateId}/council-invitations")
                        .authenticated()
                        .requestMatchers(HttpMethod.POST, "/estates")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.POST,
                                "/council-invitations/accept",
                                "/estates/{estateId}/documents",
                                "/estates/{estateId}/work-orders",
                                "/estates/{estateId}/assets/{assetId}/inspections",
                                "/council-invitations/{invitationId}/accept",
                                "/estates/{estateId}/roles",
                                "/estates/{estateId}/ownership-transfer",
                                "/estates/{estateId}/deactivate",
                                "/estates/{estateId}/locations",
                                "/estates/{estateId}/locations/{id}/deactivate",
                                "/estates/{estateId}/locations/{blockId}/floors",
                                "/estates/{estateId}/assets",
                                "/estates/{estateId}/assets/{id}/deactivate",
                                "/estates/{estateId}/assets/{id}/restore",
                                "/estates/{estateId}/assets/{assetId}/devices",
                                "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential",
                                "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/deactivate",
                                "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/replace",
                                "/estates/{estateId}/assets/{assetId}/assessments",
                                "/estates/{estateId}/assets/{assetId}/events",
                                "/estates/{estateId}/assets/{assetId}/readings/anomaly-check",
                                "/estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric}",
                                "/estates/{estateId}/council-invitations")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/estates/{estateId}/work-orders/{workOrderId}/status",
                                "/estates/{estateId}/work-orders/{workOrderId}/completion",
                                "/estates/{estateId}",
                                "/estates/{estateId}/locations/{id}",
                                "/estates/{estateId}/assets/{id}",
                                "/estates/{estateId}/assets/{id}/retirement")
                        .authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/estates/{estateId}/reports/{reportId}/location")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.PUT,
                                "/estates/{estateId}/documents/{documentId}/work-order",
                                "/estates/{estateId}/work-orders/{workOrderId}/completion",
                                "/estates/{estateId}/members/{userId}/invitation-permission",
                                "/estates/{estateId}/roles/{roleId}",
                                "/estates/{estateId}/members/{userId}/role",
                                "/estates/{estateId}/flatline-policies/{metric}")
                        .authenticated()
                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/estates/{estateId}/documents/{documentId}",
                                "/estates/{estateId}/roles/{roleId}",
                                "/estates/{estateId}/members/{userId}",
                                "/estates/{estateId}/council-invitations/{invitationId}")
                        .authenticated()
                        .anyRequest()
                        .denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(roleConverter())));
        return http.build();
    }

    /**
     * AuthKit puts the caller's role slug (e.g. {@code admin}, {@code member}) in
     * the {@code role} claim; expose it as {@code ROLE_<slug>} for {@code hasRole}.
     */
    private static JwtAuthenticationConverter roleConverter() {
        var authorities = new JwtGrantedAuthoritiesConverter();
        authorities.setAuthoritiesClaimName("role");
        authorities.setAuthorityPrefix("ROLE_");
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authorities);
        return converter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
