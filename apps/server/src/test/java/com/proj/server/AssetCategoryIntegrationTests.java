package com.proj.server;

import static com.proj.server.db.tables.Assetcategory.ASSETCATEGORY;
import static org.hamcrest.Matchers.contains;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.catalogue.AssetCategoryCodes;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AssetCategoryIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId, blockId, assetId;
    String base;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        blockId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                blockId,
                estateId);
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, 'E-A0001', 'Water Pump', 'PUMP', now())",
                assetId,
                estateId,
                blockId);
        base = "/estates/" + estateId + "/assets";
    }

    private String asset(String category) {
        return "{\"name\":\"Pump\",\"category\":\"" + category + "\",\"locationId\":\"" + blockId + "\"}";
    }

    @Test
    void listsTheThirteenSeededCategoriesWithTheirLabelsByLabel() throws Exception {
        mvc.perform(get("/asset-categories").with(jwt().jwt(j -> j.subject("anyone"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(13))
                .andExpect(jsonPath("$[*].code")
                        .value(contains(
                                "HVAC",
                                "ELECTRICAL",
                                "FACADE_ACCESS",
                                "FIRE_SAFETY",
                                "GENERATOR",
                                "LIFT",
                                "LIGHTING",
                                "OTHER",
                                "PLUMBING",
                                "PUMP",
                                "RECREATION",
                                "SECURITY",
                                "WASTE")))
                .andExpect(jsonPath("$[*].label")
                        .value(contains(
                                "Air-con & ventilation",
                                "Electrical",
                                "Facade access",
                                "Fire safety",
                                "Generator",
                                "Lift & escalator",
                                "Lighting",
                                "Other",
                                "Plumbing & water",
                                "Pump",
                                "Recreation",
                                "Security & access",
                                "Waste handling")));
    }

    @Test
    void rejectsAnUnknownCategoryCodeOnCreateAndEdit() throws Exception {
        mvc.perform(post(base)
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asset("ROCKET")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(patch(base + "/" + assetId)
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asset("ROCKET")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void everyCodeTheServerKeysConstantsOnHasASeededRow() {
        var seeded = db.select(ASSETCATEGORY.CODE).from(ASSETCATEGORY).fetchSet(ASSETCATEGORY.CODE);
        assertTrue(
                seeded.containsAll(AssetCategoryCodes.KEYED),
                () -> "Codes without a seeded AssetCategory row: " + AssetCategoryCodes.KEYED.stream()
                        .filter(code -> !seeded.contains(code))
                        .toList());
    }
}
