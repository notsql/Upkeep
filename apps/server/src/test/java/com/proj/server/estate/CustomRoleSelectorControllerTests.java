package com.proj.server.estate;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.config.SecurityConfig;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

/** Request binding/validation only; real authority and persistence are covered by integration tests. */
@WebMvcTest(
        controllers = CouncilController.class,
        properties = {
            "app.cors.allowed-origins=http://localhost:3001",
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app"
        })
@Import({SecurityConfig.class, EstateExceptionHandler.class})
class CustomRoleSelectorControllerTests {
    private static final String ROLE_ID = "332235b3-a30c-4510-91e2-f266bf2a43df";

    @Autowired
    MockMvc mvc;

    @MockitoBean
    CouncilService service;

    @MockitoBean
    JwtDecoder decoder;

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void acceptsACompleteVersionedCustomSelector(boolean invitation) throws Exception {
        perform(
                invitation,
                "\"role\":\"CUSTOM\",\"customRoleId\":\"" + ROLE_ID + "\",\"expectedRoleVersion\":1",
                invitation ? 201 : 200);
    }

    static Stream<Arguments> invalidSelectors() {
        var selectors = Stream.of(
                "\"role\":\"CUSTOM\"",
                "\"role\":\"CUSTOM\",\"customRoleId\":null,\"expectedRoleVersion\":1",
                "\"role\":\"CUSTOM\",\"customRoleId\":\"bad\",\"expectedRoleVersion\":1",
                "\"role\":\"CUSTOM\",\"customRoleId\":\"" + ROLE_ID + "\"",
                "\"role\":\"CUSTOM\",\"customRoleId\":\"" + ROLE_ID + "\",\"expectedRoleVersion\":0",
                "\"role\":\"CUSTOM\",\"customRoleId\":\"" + ROLE_ID + "\",\"expectedRoleVersion\":-1",
                "\"role\":\"CUSTOM\",\"customRoleId\":\"" + ROLE_ID + "\",\"expectedRoleVersion\":null",
                "\"role\":\"COUNCIL\",\"customRoleId\":\"" + ROLE_ID + "\"",
                "\"role\":\"COUNCIL\",\"expectedRoleVersion\":1",
                "\"role\":\"OWNER\"",
                "\"role\":\"ADMIN\"",
                "\"role\":\"MEMBER\"",
                "\"role\":null");
        return selectors.flatMap(selector -> Stream.of(Arguments.of(false, selector), Arguments.of(true, selector)));
    }

    @ParameterizedTest(name = "invalid custom/preset selector, invitation={0}, {1}")
    @MethodSource("invalidSelectors")
    void rejectsIncompleteCustomSelectorsAndPresetReferences(boolean invitation, String selector) throws Exception {
        perform(invitation, selector, 400);
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"customRoleId\":\"" + ROLE_ID + "\"", "\"expectedRoleVersion\":1"})
    void anIdOrVersionWithoutARoleCannotSilentlyDefaultToCouncil(String selector) throws Exception {
        perform(true, selector, 400);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "COUNCIL", "RESIDENT", "CREW"})
    void existingPresetRequestsRemainCompatible(String preset) throws Exception {
        perform(false, "\"role\":\"" + preset + "\"", 200);
        perform(true, "\"role\":\"" + preset + "\"", 201);
    }

    @org.junit.jupiter.api.Test
    void existingEmailOnlyInvitationsRemainCompatible() throws Exception {
        var request = post("/estates/" + UUID.randomUUID() + "/council-invitations");
        mvc.perform(request.with(jwt().jwt(token -> token.subject("manager")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(Map.of("email", "recipient@example.com"))))
                .andExpect(status().isCreated());
    }

    private void perform(boolean invitation, String fields, int expected) throws Exception {
        var estate = "/estates/" + UUID.randomUUID();
        MockHttpServletRequestBuilder request =
                invitation ? post(estate + "/council-invitations") : put(estate + "/members/recipient/role");
        var payload = "{" + (invitation ? "\"email\":\"recipient@example.com\"," : "") + fields + "}";
        mvc.perform(request.with(jwt().jwt(token -> token.subject("manager")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().is(expected));
    }
}
