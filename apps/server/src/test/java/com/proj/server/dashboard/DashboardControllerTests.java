package com.proj.server.dashboard;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.config.SecurityConfig;
import org.jooq.exception.DataAccessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DashboardController.class)
@Import({SecurityConfig.class, DashboardExceptionHandler.class})
class DashboardControllerTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    DashboardService service;

    @Test
    void hidesDatabaseDetailsWhenTheSummaryIsUnavailable() throws Exception {
        when(service.summary("owner")).thenThrow(new DataAccessException("SQL: private table details"));
        mvc.perform(get("/dashboard/summary").with(jwt().jwt(token -> token.subject("owner"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(
                        jsonPath("$.message").value("Dashboard summary is temporarily unavailable. Please try again."));
    }
}
