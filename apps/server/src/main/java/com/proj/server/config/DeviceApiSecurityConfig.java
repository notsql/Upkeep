package com.proj.server.config;

import com.proj.server.device.DeviceKeyAuthenticationFilter;
import com.proj.server.device.DeviceRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

/**
 * /device-api/** has its own chain, ordered before {@link SecurityConfig}'s, so it
 * always requires a device key - even when the JWT issuer is unset and the main
 * chain allows everything - and never accepts a user's JWT (decision 0025).
 * Devices are not browsers, so there is no CORS and no CSRF.
 */
@Configuration
public class DeviceApiSecurityConfig {
    /** One message for every rejection, so a response never says which case applied. */
    private static final String REJECTED = "{\"message\":\"A valid device key is required.\"}";

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    SecurityFilterChain deviceApiFilterChain(HttpSecurity http, DeviceRepository devices) throws Exception {
        http.securityMatcher("/device-api/**")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new DeviceKeyAuthenticationFilter(devices), AnonymousAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                .exceptionHandling(e -> e.authenticationEntryPoint((request, response, error) -> {
                    response.setStatus(401);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(REJECTED);
                }));
        return http.build();
    }
}
