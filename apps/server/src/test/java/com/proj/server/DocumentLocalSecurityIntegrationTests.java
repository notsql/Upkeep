package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(
        properties = {
            "spring.config.import=",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES="
        })
class DocumentLocalSecurityIntegrationTests extends DocumentTestSupport {
    @Test
    void documentsStillRequireIdentityInLocalOpenSecurityMode() throws Exception {
        mvc.perform(get(documents())).andExpect(status().isUnauthorized());
        mvc.perform(submission("INVOICE", pdfFile("invoice.pdf"))).andExpect(status().isUnauthorized());
        mvc.perform(get(downloadPath(UUID.randomUUID()))).andExpect(status().isUnauthorized());
        mvc.perform(delete(documents() + "/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
    }
}
