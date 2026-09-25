package com.proj.server.estate;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.config.SecurityConfig;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = EstateController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, EstateService.class, EstateExceptionHandler.class})
class EstateControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    EstateRepository repository;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID id = UUID.fromString("ac514a8e-c643-4a59-aa93-30138327f039");
    private final OffsetDateTime now = OffsetDateTime.parse("2026-09-25T00:00:00Z");
    private final String body = """
        {"name":" Maple Grove ","code":" mg-001 ","address":" 1 Grove Road ",
         "postalCode":" 123456 ","description":" A property ","ownerUserId":"attacker"}
        """;

    private EstateResponse estate(OffsetDateTime deactivatedAt) {
        return new EstateResponse(
                id, "Maple Grove", "MG-001", "1 Grove Road", "123456", "A property", now, now, deactivatedAt);
    }

    @BeforeEach
    void setup() {
        when(repository.findOwned(id, "owner", false)).thenReturn(Optional.of(estate(null)));
        when(repository.findOwned(id, "owner", true)).thenReturn(Optional.of(estate(null)));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/estates")).andExpect(status().isUnauthorized());
    }

    @Test
    void createsForTokenOwnerAndNormalizesDetails() throws Exception {
        when(repository.create(
                        eq("owner"),
                        eq(new EstateRequest("Maple Grove", "MG-001", "1 Grove Road", "123456", "A property"))))
                .thenReturn(estate(null));
        mvc.perform(post("/estates")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("MG-001"))
                .andExpect(header().string("Location", "/estates/" + id));
    }

    @Test
    void rejectsBlankDetails() throws Exception {
        mvc.perform(post("/estates")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace(" Maple Grove ", "   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void reportsDuplicateCodesWithoutDatabaseDetails() throws Exception {
        when(repository.create(anyString(), any())).thenThrow(new DuplicateKeyException("sensitive SQL"));
        mvc.perform(post("/estates")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An estate with this code already exists."));
    }

    @Test
    void listsOnlyOwnedEstatesWithRequestedFilter() throws Exception {
        when(repository.listOwned("owner", EstateStatus.INACTIVE)).thenReturn(List.of(estate(now)));
        mvc.perform(get("/estates?status=INACTIVE").with(jwt().jwt(t -> t.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deactivatedAt").isNotEmpty());
    }

    @Test
    void hidesOtherOwnersEstatesOnReadEditAndDeactivate() throws Exception {
        mvc.perform(get("/estates/" + id).with(jwt().jwt(t -> t.subject("other"))))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/estates/" + id)
                        .with(jwt().jwt(t -> t.subject("other")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound());
        mvc.perform(post("/estates/" + id + "/deactivate")
                        .with(jwt().jwt(t -> t.subject("other")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"MG-001\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void editsInactiveEstateWithoutReactivatingIt() throws Exception {
        when(repository.findOwned(id, "owner", true)).thenReturn(Optional.of(estate(now)));
        when(repository.update(eq(id), eq("owner"), any())).thenReturn(estate(now));
        mvc.perform(patch("/estates/" + id)
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedAt").isNotEmpty());
    }

    @Test
    void requiresExactCodeToDeactivate() throws Exception {
        mvc.perform(post("/estates/" + id + "/deactivate")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"mg-001\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deactivatesAndPreservesTheEstate() throws Exception {
        when(repository.deactivate(id, "owner")).thenReturn(estate(now));
        mvc.perform(post("/estates/" + id + "/deactivate")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"MG-001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.deactivatedAt").isNotEmpty());
    }

    @Test
    void repeatedDeactivationPreservesOriginalTimestamp() throws Exception {
        when(repository.findOwned(id, "owner", true)).thenReturn(Optional.of(estate(now)));
        mvc.perform(post("/estates/" + id + "/deactivate")
                        .with(jwt().jwt(t -> t.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"MG-001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedAt").value("2026-09-25T00:00:00Z"));
    }
}
