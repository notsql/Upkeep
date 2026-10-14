package com.proj.server.catalogue;

import static com.proj.server.db.tables.Assetcategory.ASSETCATEGORY;
import static com.proj.server.db.tables.Assetmodel.ASSETMODEL;
import static com.proj.server.db.tables.Manufacturer.MANUFACTURER;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/**
 * The asset categories and the shared manufacturer and model catalogue. Names are normalised here, so every caller
 * resolves "Grundfos", " grundfos " and "GRUNDFOS" to the same row.
 */
@Repository
public class CatalogueRepository {
    static final int LOOKUP_LIMIT = 20;

    private final DSLContext db;

    public CatalogueRepository(DSLContext db) {
        this.db = db;
    }

    /** Trimmed, inner whitespace collapsed to one space, uppercased. Blank or null gives null. */
    public static String normalise(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.strip().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    public boolean categoryExists(String code) {
        return code != null && db.fetchExists(ASSETCATEGORY, ASSETCATEGORY.CODE.eq(code));
    }

    public List<AssetCategoryResponse> categories() {
        return db.select(ASSETCATEGORY.CODE, ASSETCATEGORY.LABEL)
                .from(ASSETCATEGORY)
                .orderBy(ASSETCATEGORY.LABEL, ASSETCATEGORY.CODE)
                .fetch(row -> new AssetCategoryResponse(row.value1(), row.value2()));
    }

    public boolean manufacturerExists(UUID id) {
        return db.fetchExists(MANUFACTURER, MANUFACTURER.ID.eq(id));
    }

    /** Names containing the normalised query (all when it is blank), ordered by name, at most 20. */
    public List<ManufacturerResponse> manufacturers(String query) {
        var normalised = normalise(query);
        return db.select(MANUFACTURER.ID, MANUFACTURER.NAME)
                .from(MANUFACTURER)
                .where(normalised == null ? org.jooq.impl.DSL.noCondition() : MANUFACTURER.NAME.contains(normalised))
                .orderBy(MANUFACTURER.NAME, MANUFACTURER.ID)
                .limit(LOOKUP_LIMIT)
                .fetch(row -> new ManufacturerResponse(row.value1(), row.value2()));
    }

    /** The manufacturer's models in the category whose names contain the normalised query, at most 20. */
    public List<AssetModelResponse> models(UUID manufacturerId, String category, String query) {
        var normalised = normalise(query);
        return db.select(ASSETMODEL.ID, ASSETMODEL.MANUFACTURERID, ASSETMODEL.CATEGORY, ASSETMODEL.NAME)
                .from(ASSETMODEL)
                .where(ASSETMODEL.MANUFACTURERID.eq(manufacturerId))
                .and(ASSETMODEL.CATEGORY.eq(category))
                .and(normalised == null ? org.jooq.impl.DSL.noCondition() : ASSETMODEL.NAME.contains(normalised))
                .orderBy(ASSETMODEL.NAME, ASSETMODEL.ID)
                .limit(LOOKUP_LIMIT)
                .fetch(row -> new AssetModelResponse(row.value1(), row.value2(), row.value3(), row.value4()));
    }

    /**
     * Finds the manufacturer by its normalised name, creating it if missing. Two saves adding the same name at once
     * both resolve to one row: insert on conflict, then read back. Null or blank in, null out.
     */
    public UUID manufacturerId(String name) {
        var normalised = normalise(name);
        if (normalised == null) {
            return null;
        }
        db.insertInto(MANUFACTURER)
                .set(MANUFACTURER.ID, UUID.randomUUID())
                .set(MANUFACTURER.NAME, normalised)
                .onConflict(MANUFACTURER.NAME)
                .doNothing()
                .execute();
        return db.select(MANUFACTURER.ID)
                .from(MANUFACTURER)
                .where(MANUFACTURER.NAME.eq(normalised))
                .fetchSingle(MANUFACTURER.ID);
    }

    /** Finds or creates the model by its normalised name under the manufacturer and category. */
    public UUID modelId(UUID manufacturerId, String category, String name) {
        var normalised = normalise(name);
        if (manufacturerId == null || normalised == null) {
            return null;
        }
        db.insertInto(ASSETMODEL)
                .set(ASSETMODEL.ID, UUID.randomUUID())
                .set(ASSETMODEL.MANUFACTURERID, manufacturerId)
                .set(ASSETMODEL.CATEGORY, category)
                .set(ASSETMODEL.NAME, normalised)
                .onConflict(ASSETMODEL.MANUFACTURERID, ASSETMODEL.CATEGORY, ASSETMODEL.NAME)
                .doNothing()
                .execute();
        return db.select(ASSETMODEL.ID)
                .from(ASSETMODEL)
                .where(ASSETMODEL.MANUFACTURERID.eq(manufacturerId))
                .and(ASSETMODEL.CATEGORY.eq(category))
                .and(ASSETMODEL.NAME.eq(normalised))
                .fetchSingle(ASSETMODEL.ID);
    }

    public String manufacturerName(UUID id) {
        return id == null
                ? null
                : db.select(MANUFACTURER.NAME)
                        .from(MANUFACTURER)
                        .where(MANUFACTURER.ID.eq(id))
                        .fetchSingle(MANUFACTURER.NAME);
    }

    public String modelName(UUID id) {
        return id == null
                ? null
                : db.select(ASSETMODEL.NAME)
                        .from(ASSETMODEL)
                        .where(ASSETMODEL.ID.eq(id))
                        .fetchSingle(ASSETMODEL.NAME);
    }
}
