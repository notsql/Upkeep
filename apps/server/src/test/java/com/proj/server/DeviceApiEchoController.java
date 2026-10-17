package com.proj.server;

import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only stand-in for the first real /device-api endpoint (ID-43): echoes the
 * device the request authenticated as, or "none".
 */
@RestController
class DeviceApiEchoController {
    @GetMapping("/device-api/test/whoami")
    String whoami(@AuthenticationPrincipal UUID deviceId) {
        return deviceId == null ? "none" : deviceId.toString();
    }
}
