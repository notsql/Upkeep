package com.proj.server.risk;

import static com.proj.server.db.tables.Asset.ASSET;

import com.proj.server.db.tables.records.AssetRecord;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class FailureRiskRepository {
    private final DSLContext db;

    public FailureRiskRepository(DSLContext db) {
        this.db = db;
    }

    /** The estate's active assets in the given categories. */
    public List<AssetRecord> activeAssets(UUID estateId, Set<String> categories) {
        return db.selectFrom(ASSET)
                .where(ASSET.ESTATEID.eq(estateId))
                .and(ASSET.DEACTIVATEDAT.isNull())
                .and(ASSET.CATEGORY.in(categories))
                .orderBy(ASSET.REFERENCE, ASSET.ID)
                .fetch();
    }
}
