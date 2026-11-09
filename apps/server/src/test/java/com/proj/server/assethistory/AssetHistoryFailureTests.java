package com.proj.server.assethistory;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.config.SecurityConfig;
import java.util.UUID;
import org.jooq.exception.DataAccessException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = AssetHistoryController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, AssetHistoryExceptionHandler.class})
class AssetHistoryFailureTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    AssetHistoryService service;

    @MockitoBean
    JwtDecoder decoder;

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void sourceFailuresReturnAPrivateErrorEnvelopeWithoutPartialHistory(boolean list) throws Exception {
        var error = new DataAccessException("Private database detail must not escape");
        when(service.history(
                        any(),
                        any(),
                        anyString(),
                        nullable(String.class),
                        anyInt(),
                        nullable(String.class),
                        nullable(String.class)))
                .thenThrow(error);
        when(service.assets(any(), anyString(), nullable(String.class), any(), nullable(String.class), anyInt()))
                .thenThrow(error);
        String path = "/estates/" + UUID.randomUUID()
                + (list ? "/asset-history" : "/assets/" + UUID.randomUUID() + "/history");
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isInternalServerError())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.message").value("Couldn't load the history. Try again."))
                .andExpect(jsonPath("$.items").doesNotExist())
                .andExpect(jsonPath("$.asset").doesNotExist());
    }
}
