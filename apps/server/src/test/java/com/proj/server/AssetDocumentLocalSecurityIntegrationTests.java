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
class AssetDocumentLocalSecurityIntegrationTests extends DocumentTestSupport {
    @Test
    void assetDocumentReadsAndWritesRequireIdentityEvenInLocalOpenSecurityMode() throws Exception {
        String association = documents() + "/" + UUID.randomUUID() + "/asset";
        mvc.perform(get(association)).andExpect(status().isUnauthorized());
        mvc.perform(get(path() + "/assets/" + UUID.randomUUID() + "/documents")).andExpect(status().isUnauthorized());
        mvc.perform(put(association)
                        .contentType("application/json")
                        .content("{\"assetId\":null,\"expectedAssociationVersion\":0}"))
                .andExpect(status().isUnauthorized());
    }
}
