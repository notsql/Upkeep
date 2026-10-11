package com.proj.server.catalogue;

import static com.proj.server.db.tables.Assetmodel.ASSETMODEL;
import static com.proj.server.db.tables.Manufacturer.MANUFACTURER;

import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** The shared manufacturer and model catalogue. Names are matched exactly. */
@Repository
public class CatalogueRepository {
    private final DSLContext db;

    public CatalogueRepository(DSLContext db) {
        this.db = db;
    }

    /** Finds the manufacturer with this exact name, creating it if missing. Null in, null out. */
    public UUID manufacturerId(String name) {
        if (name == null) {
            return null;
        }
        db.insertInto(MANUFACTURER)
                .set(MANUFACTURER.ID, UUID.randomUUID())
                .set(MANUFACTURER.NAME, name)
                .onConflict(MANUFACTURER.NAME)
                .doNothing()
                .execute();
        return db.select(MANUFACTURER.ID)
                .from(MANUFACTURER)
                .where(MANUFACTURER.NAME.eq(name))
                .fetchSingle(MANUFACTURER.ID);
    }

    /** Finds the model with this exact name for the manufacturer and category, creating it if missing. */
    public UUID modelId(UUID manufacturerId, String category, String name) {
        if (manufacturerId == null || name == null) {
            return null;
        }
        db.insertInto(ASSETMODEL)
                .set(ASSETMODEL.ID, UUID.randomUUID())
                .set(ASSETMODEL.MANUFACTURERID, manufacturerId)
                .set(ASSETMODEL.CATEGORY, category)
                .set(ASSETMODEL.NAME, name)
                .onConflict(ASSETMODEL.MANUFACTURERID, ASSETMODEL.CATEGORY, ASSETMODEL.NAME)
                .doNothing()
                .execute();
        return db.select(ASSETMODEL.ID)
                .from(ASSETMODEL)
                .where(ASSETMODEL.MANUFACTURERID.eq(manufacturerId))
                .and(ASSETMODEL.CATEGORY.eq(category))
                .and(ASSETMODEL.NAME.eq(name))
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
