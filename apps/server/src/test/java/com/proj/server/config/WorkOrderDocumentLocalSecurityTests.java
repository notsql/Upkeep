package com.proj.server.config;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.workorder.WorkOrderDocumentController;
import com.proj.server.workorder.WorkOrderDocumentExceptionHandler;
import com.proj.server.workorder.WorkOrderDocumentService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = WorkOrderDocumentController.class,
        properties = {
            "spring.config.import=", "app.cors.allowed-origins=http://localhost:3001",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=",
                    "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES="
        })
@Import({SecurityConfig.class, WorkOrderDocumentExceptionHandler.class})
class WorkOrderDocumentLocalSecurityTests {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    WorkOrderDocumentService documents;

    @Test
    void documentAssociationsStillRequireIdentityInLocalOpenSecurityMode() throws Exception {
        String base = "/estates/" + UUID.randomUUID();
        String association = base + "/documents/" + UUID.randomUUID() + "/work-order";
        for (String path : new String[] {
            association, association + "/history", base + "/work-orders/" + UUID.randomUUID() + "/documents"
        }) {
            mvc.perform(get(path))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").isNotEmpty());
        }
        mvc.perform(put(association)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"workOrderId\":null,\"expectedAssociationVersion\":0}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(documents);
    }
}
