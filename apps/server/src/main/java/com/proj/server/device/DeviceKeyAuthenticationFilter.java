package com.proj.server.device;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates {@code Authorization: Bearer upk_...} as the device holding that
 * key, with the device ID as principal. Anything else leaves the request
 * unauthenticated, and the chain's entry point answers 401. The key is never
 * logged or echoed.
 */
public class DeviceKeyAuthenticationFilter extends OncePerRequestFilter {
    private static final String BEARER = "Bearer ";

    private final DeviceRepository devices;

    public DeviceKeyAuthenticationFilter(DeviceRepository devices) {
        this.devices = devices;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)) {
            var key = header.substring(BEARER.length());
            if (DeviceKeys.wellFormed(key)) {
                devices.findIdByCredentialHash(DeviceKeys.hash(key)).ifPresent(deviceId -> {
                    var strategy = SecurityContextHolder.getContextHolderStrategy();
                    var context = strategy.createEmptyContext();
                    context.setAuthentication(new PreAuthenticatedAuthenticationToken(deviceId, null, List.of()));
                    strategy.setContext(context);
                });
            }
        }
        chain.doFilter(request, response);
    }
}
