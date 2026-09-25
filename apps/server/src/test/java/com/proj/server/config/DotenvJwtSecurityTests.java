package com.proj.server.config;

import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.estate.EstateController;
import com.proj.server.estate.EstateExceptionHandler;
import com.proj.server.estate.EstateService;
import com.proj.server.estate.EstateStatus;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = EstateController.class,
        properties = {
            "spring.config.import=",
            "app.cors.allowed-origins=http://localhost:3001",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=https://issuer.example.com",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES=http://localhost:8080"
        })
@Import({SecurityConfig.class, EstateExceptionHandler.class})
class DotenvJwtSecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    EstateService service;

    @Test
    void authenticatesBearerTokenWhenSettingsComeFromDotenvStyleProperties() throws Exception {
        when(decoder.decode("valid-token"))
                .thenReturn(Jwt.withTokenValue("valid-token")
                        .header("alg", "RS256")
                        .subject("owner")
                        .build());
        when(service.list("owner", EstateStatus.ACTIVE)).thenReturn(List.of());
        mvc.perform(get("/estates").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void rejectsMissingTokenAtTheSecurityFilter() throws Exception {
        mvc.perform(get("/estates"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", startsWith("Bearer")));
    }
}
