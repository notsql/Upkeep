package com.proj.server.config;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.workorder.WorkOrderController;
import com.proj.server.workorder.WorkOrderExceptionHandler;
import com.proj.server.workorder.WorkOrderService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = WorkOrderController.class,
        properties = {
            "spring.config.import=",
            "app.cors.allowed-origins=http://localhost:3001",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES="
        })
@Import({SecurityConfig.class, WorkOrderExceptionHandler.class})
class WorkOrderLocalSecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    WorkOrderService orders;

    @MockitoBean
    com.proj.server.workorder.WorkOrderProgressService progress;

    @Test
    void missingIdentityIsRejectedEvenWithoutConfiguredJwt() throws Exception {
        String base = "/estates/" + UUID.randomUUID();
        for (String path : new String[] {"/work-orders", "/work-orders/" + UUID.randomUUID(), "/work-order-assets"}) {
            mvc.perform(get(base + path))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").isString());
        }
        mvc.perform(post(base + "/work-orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
            {"description":"Leak","locationId":"%s","category":"CLEANLINESS","priority":"LOW","source":"MANUAL"}
            """.formatted(UUID.randomUUID())))
                .andExpect(status().isUnauthorized());
        var id = UUID.randomUUID();
        for (String path :
                new String[] {"/work-orders/" + id + "/status-history", "/assets/" + id + "/work-order-completions"}) {
            mvc.perform(get(base + path)).andExpect(status().isUnauthorized());
        }
        mvc.perform(patch(base + "/work-orders/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetStatus\":\"IN_PROGRESS\",\"expectedVersion\":0}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(
                        put(base + "/work-orders/" + id + "/completion")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expectedVersion\":1,\"findings\":\"Worn seal\",\"workPerformed\":\"Replaced seal\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(orders, progress);
    }
}
