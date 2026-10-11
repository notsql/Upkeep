package com.proj.server;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetmodel.ASSETMODEL;
import static com.proj.server.db.tables.Manufacturer.MANUFACTURER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Locale;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CatalogueIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId, blockId, assetId;
    String base;

    /** Unique per test, so names never collide with catalogue rows from other tests. */
    String token;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        blockId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        token = "T" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
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

    private String asset(String category, String manufacturer, String model) {
        return "{\"name\":\"Pump\",\"category\":\"" + category + "\",\"locationId\":\"" + blockId + "\""
                + (manufacturer == null ? "" : ",\"manufacturer\":\"" + manufacturer + "\"")
                + (model == null ? "" : ",\"model\":\"" + model + "\"")
                + "}";
    }

    private ResultActions create(String category, String manufacturer, String model) throws Exception {
        return mvc.perform(post(base)
                .with(jwt().jwt(j -> j.subject("owner")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(asset(category, manufacturer, model)));
    }

    /** A signed-in GET with query parameters given as name, value pairs. */
    private ResultActions lookup(String path, String... params) throws Exception {
        var request = get(path).with(jwt().jwt(j -> j.subject("anyone")));
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mvc.perform(request);
    }

    private UUID manufacturer(String name) {
        var id = UUID.randomUUID();
        db.execute("insert into \"Manufacturer\" (id, name) values (?, ?)", id, name);
        return id;
    }

    private void model(UUID manufacturerId, String category, String name) {
        db.execute(
                "insert into \"AssetModel\" (id, \"manufacturerId\", category, name) values (?, ?, ?, ?)",
                UUID.randomUUID(),
                manufacturerId,
                category,
                name);
    }

    private int manufacturersContainingToken() {
        return db.fetchCount(MANUFACTURER, MANUFACTURER.NAME.containsIgnoreCase(token));
    }

    private int modelsContainingToken() {
        return db.fetchCount(ASSETMODEL, ASSETMODEL.NAME.containsIgnoreCase(token));
    }

    @Test
    void savingCreatesANewManufacturerAndModelThenReusesThemAcrossCaseAndSpacing() throws Exception {
        create("PUMP", "Grundfos " + token, "CR 3 " + token).andExpect(status().isCreated());
        assertEquals(1, manufacturersContainingToken());
        assertEquals(1, modelsContainingToken());

        create("PUMP", "  grundfos   " + token.toLowerCase(Locale.ROOT) + " ", "cr  3   " + token.toLowerCase(Locale.ROOT))
                .andExpect(status().isCreated());
        assertEquals(1, manufacturersContainingToken());
        assertEquals(1, modelsContainingToken());
    }

    @Test
    void namesAreStoredAndReturnedTrimmedSingleSpacedAndUppercase() throws Exception {
        var lower = token.toLowerCase(Locale.ROOT);
        create("PUMP", "  grundfos   " + lower + "  ", " cr   3  " + lower)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.manufacturer").value("GRUNDFOS " + token))
                .andExpect(jsonPath("$.model").value("CR 3 " + token));
        assertEquals(
                "GRUNDFOS " + token,
                db.select(MANUFACTURER.NAME)
                        .from(MANUFACTURER)
                        .where(MANUFACTURER.NAME.containsIgnoreCase(token))
                        .fetchSingle(MANUFACTURER.NAME));
        assertEquals(
                "CR 3 " + token,
                db.select(ASSETMODEL.NAME)
                        .from(ASSETMODEL)
                        .where(ASSETMODEL.NAME.containsIgnoreCase(token))
                        .fetchSingle(ASSETMODEL.NAME));
        lookup("/manufacturers", "query", lower)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("GRUNDFOS " + token));
    }

    @Test
    void rejectsAModelWithoutAManufacturerOnCreateAndEdit() throws Exception {
        create("PUMP", null, "CR 3 " + token)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(patch(base + "/" + assetId)
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asset("PUMP", "   ", "CR 3 " + token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, modelsContainingToken());
        assertEquals(1, db.fetchCount(ASSET, ASSET.ESTATEID.eq(estateId)));
    }

    @Test
    void theSameModelNameInTwoCategoriesIsTwoRowsAndTheModelsLookupFiltersByCategory() throws Exception {
        create("PUMP", "Acme " + token, "X1 " + token).andExpect(status().isCreated());
        create("HVAC", "Acme " + token, "X1 " + token).andExpect(status().isCreated());
        assertEquals(1, manufacturersContainingToken());
        assertEquals(2, modelsContainingToken());

        var manufacturerId = db.select(MANUFACTURER.ID)
                .from(MANUFACTURER)
                .where(MANUFACTURER.NAME.containsIgnoreCase(token))
                .fetchSingle(MANUFACTURER.ID);
        var models = "/manufacturers/" + manufacturerId + "/models";
        lookup(models, "category", "PUMP")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].manufacturerId").value(manufacturerId.toString()))
                .andExpect(jsonPath("$[0].category").value("PUMP"))
                .andExpect(jsonPath("$[0].name").value("X1 " + token));
        lookup(models, "category", "HVAC")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].category").value("HVAC"));
        lookup(models, "category", "LIFT").andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void theLookupsFilterByTheNormalisedQuery() throws Exception {
        var acme = manufacturer("ACME " + token);
        manufacturer("ZENITH " + token);
        model(acme, "PUMP", "CR 3 " + token);
        model(acme, "PUMP", "NB 40 " + token);

        lookup("/manufacturers", "query", "  acme   " + token.toLowerCase(Locale.ROOT) + " ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(acme.toString()))
                .andExpect(jsonPath("$[0].name").value("ACME " + token));
        lookup("/manufacturers/" + acme + "/models", "category", "PUMP", "query", "cr  3")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("CR 3 " + token));
    }

    @Test
    void theLookupsReturnAtMostTwentyOrderedByName() throws Exception {
        var first = manufacturer(token + " 01");
        for (int i = 2; i <= 25; i++) {
            manufacturer(token + " %02d".formatted(i));
        }
        for (int i = 1; i <= 25; i++) {
            model(first, "PUMP", token + " %02d".formatted(i));
        }

        lookup("/manufacturers", "query", token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(20))
                .andExpect(jsonPath("$[0].name").value(token + " 01"))
                .andExpect(jsonPath("$[19].name").value(token + " 20"));
        lookup("/manufacturers/" + first + "/models", "category", "PUMP", "query", token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(20))
                .andExpect(jsonPath("$[0].name").value(token + " 01"))
                .andExpect(jsonPath("$[19].name").value(token + " 20"));
    }

    @Test
    void theModelsLookupRejectsAnUnknownManufacturerOrCategory() throws Exception {
        var acme = manufacturer("ACME " + token);
        lookup("/manufacturers/" + UUID.randomUUID() + "/models", "category", "PUMP").andExpect(status().isNotFound());
        lookup("/manufacturers/" + acme + "/models", "category", "ROCKET").andExpect(status().isBadRequest());
        lookup("/manufacturers/" + acme + "/models").andExpect(status().isBadRequest());
    }
}
