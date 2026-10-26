package com.proj.server.inspection;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetinspectionphoto.ASSETINSPECTIONPHOTO;
import static com.proj.server.db.tables.Assetinspectionresult.ASSETINSPECTIONRESULT;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Workorder.WORKORDER;

import com.proj.server.db.tables.records.AssetinspectionresultRecord;
import com.proj.server.db.tables.records.EstateRecord;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class InspectionRepository {
    private final DSLContext db;

    public InspectionRepository(DSLContext db) {
        this.db = db;
    }

    public EstateRecord estate(UUID estate, boolean lock) {
        var query = db.selectFrom(ESTATE).where(ESTATE.ID.eq(estate));
        return lock ? query.forUpdate().fetchOne() : query.fetchOne();
    }

    public String role(UUID estate, String user) {
        return db.select(ESTATEUSER.ROLE)
                .from(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estate).and(ESTATEUSER.USERID.eq(user)))
                .fetchOne(ESTATEUSER.ROLE);
    }

    public InspectionAssetResponse asset(UUID estate, UUID asset) {
        return assets(ASSET.ESTATEID.eq(estate).and(ASSET.ID.eq(asset)), 1).stream()
                .findFirst()
                .orElse(null);
    }

    public List<InspectionAssetResponse> assets(UUID estate, String query, InspectionAssetResponse cursor, int limit) {
        Condition condition = ASSET.ESTATEID.eq(estate);
        if (query != null && !query.isBlank())
            condition =
                    condition.and(ASSET.REFERENCE.containsIgnoreCase(query).or(ASSET.NAME.containsIgnoreCase(query)));
        if (cursor != null)
            condition = condition.and(DSL.row(ASSET.REFERENCE, ASSET.ID).gt(cursor.reference(), cursor.id()));
        return assets(condition, limit);
    }

    private List<InspectionAssetResponse> assets(Condition condition, int limit) {
        var parent = LOCATION.as("inspection_parent");
        var grandparent = LOCATION.as("inspection_grandparent");
        var path = DSL.concatWs(" / ", grandparent.NAME, parent.NAME, LOCATION.NAME)
                .as("locationPath");
        var active = DSL.field(LOCATION.DEACTIVATEDAT
                        .isNull()
                        .and(parent.DEACTIVATEDAT.isNull())
                        .and(grandparent.DEACTIVATEDAT.isNull()))
                .as("locationActive");
        return db.select(
                        ASSET.ID,
                        ASSET.ESTATEID,
                        ASSET.LOCATIONID,
                        ASSET.REFERENCE,
                        ASSET.NAME,
                        ASSET.CATEGORY,
                        ASSET.INSTALLEDON,
                        ASSET.DEACTIVATEDAT,
                        ASSET.RETIREDON,
                        ESTATE.DEACTIVATEDAT,
                        path,
                        active)
                .from(ASSET)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ASSET.ESTATEID))
                .join(LOCATION)
                .on(LOCATION.ID.eq(ASSET.LOCATIONID).and(LOCATION.ESTATEID.eq(ASSET.ESTATEID)))
                .leftJoin(parent)
                .on(parent.ID.eq(LOCATION.PARENTID).and(parent.ESTATEID.eq(LOCATION.ESTATEID)))
                .leftJoin(grandparent)
                .on(grandparent.ID.eq(parent.PARENTID).and(grandparent.ESTATEID.eq(LOCATION.ESTATEID)))
                .where(condition)
                .orderBy(ASSET.REFERENCE, ASSET.ID)
                .limit(limit)
                .fetch(row -> new InspectionAssetResponse(
                        row.get(ASSET.ID),
                        row.get(ASSET.ESTATEID),
                        row.get(ASSET.LOCATIONID),
                        row.get(ASSET.REFERENCE),
                        row.get(ASSET.NAME),
                        row.get(ASSET.CATEGORY),
                        row.get(path),
                        row.get(ASSET.INSTALLEDON),
                        row.get(ESTATE.DEACTIVATEDAT) == null,
                        row.get(ASSET.DEACTIVATEDAT) == null && row.get(ASSET.RETIREDON) == null,
                        Boolean.TRUE.equals(row.get(active))));
    }

    public AssetinspectionresultRecord result(UUID estate, UUID id) {
        return db.selectFrom(ASSETINSPECTIONRESULT)
                .where(ASSETINSPECTIONRESULT.ESTATEID.eq(estate).and(ASSETINSPECTIONRESULT.ID.eq(id)))
                .fetchOne();
    }

    public List<AssetinspectionresultRecord> results(
            UUID estate, UUID asset, AssetinspectionresultRecord cursor, int limit) {
        Condition condition = ASSETINSPECTIONRESULT.ESTATEID.eq(estate).and(ASSETINSPECTIONRESULT.ASSETID.eq(asset));
        if (cursor != null)
            condition = condition.and(DSL.row(
                            ASSETINSPECTIONRESULT.INSPECTEDON,
                            ASSETINSPECTIONRESULT.CREATEDAT,
                            ASSETINSPECTIONRESULT.ID)
                    .lt(cursor.getInspectedon(), cursor.getCreatedat(), cursor.getId()));
        return db.selectFrom(ASSETINSPECTIONRESULT)
                .where(condition)
                .orderBy(
                        ASSETINSPECTIONRESULT.INSPECTEDON.desc(),
                        ASSETINSPECTIONRESULT.CREATEDAT.desc(),
                        ASSETINSPECTIONRESULT.ID.desc())
                .limit(limit)
                .fetch();
    }

    public void create(
            UUID id,
            InspectionAssetResponse asset,
            InspectionOutcome outcome,
            LocalDate date,
            String notes,
            String user,
            String name) {
        db.insertInto(ASSETINSPECTIONRESULT)
                .set(ASSETINSPECTIONRESULT.ID, id)
                .set(ASSETINSPECTIONRESULT.ESTATEID, asset.estateId())
                .set(ASSETINSPECTIONRESULT.ASSETID, asset.id())
                .set(ASSETINSPECTIONRESULT.LOCATIONID, asset.locationId())
                .set(ASSETINSPECTIONRESULT.LOCATIONPATH, asset.locationPath())
                .set(ASSETINSPECTIONRESULT.OUTCOME, outcome.name())
                .set(ASSETINSPECTIONRESULT.INSPECTEDON, date)
                .set(ASSETINSPECTIONRESULT.NOTES, notes)
                .set(ASSETINSPECTIONRESULT.RECORDEDBYUSERID, user)
                .set(ASSETINSPECTIONRESULT.RECORDEDBYNAME, name)
                .set(ASSETINSPECTIONRESULT.CREATEDAT, OffsetDateTime.now(java.time.ZoneOffset.UTC))
                .execute();
    }

    public void photo(UUID id, UUID estate, UUID result, String key, String type, int size) {
        db.insertInto(ASSETINSPECTIONPHOTO)
                .set(ASSETINSPECTIONPHOTO.ID, id)
                .set(ASSETINSPECTIONPHOTO.ESTATEID, estate)
                .set(ASSETINSPECTIONPHOTO.INSPECTIONRESULTID, result)
                .set(ASSETINSPECTIONPHOTO.STORAGEKEY, key)
                .set(ASSETINSPECTIONPHOTO.CONTENTTYPE, type)
                .set(ASSETINSPECTIONPHOTO.SIZEBYTES, size)
                .execute();
    }

    public com.proj.server.db.tables.records.AssetinspectionphotoRecord photo(UUID estate, UUID result, UUID photo) {
        return db.selectFrom(ASSETINSPECTIONPHOTO)
                .where(ASSETINSPECTIONPHOTO
                        .ESTATEID
                        .eq(estate)
                        .and(ASSETINSPECTIONPHOTO.INSPECTIONRESULTID.eq(result))
                        .and(ASSETINSPECTIONPHOTO.ID.eq(photo)))
                .fetchOne();
    }

    public boolean hasStorageKey(String key) {
        return db.fetchExists(ASSETINSPECTIONPHOTO, ASSETINSPECTIONPHOTO.STORAGEKEY.eq(key));
    }

    public InspectionResultResponse response(AssetinspectionresultRecord row) {
        var photos = db.selectFrom(ASSETINSPECTIONPHOTO)
                .where(ASSETINSPECTIONPHOTO
                        .ESTATEID
                        .eq(row.getEstateid())
                        .and(ASSETINSPECTIONPHOTO.INSPECTIONRESULTID.eq(row.getId())))
                .orderBy(ASSETINSPECTIONPHOTO.CREATEDAT, ASSETINSPECTIONPHOTO.ID)
                .fetch(photo ->
                        new InspectionResultResponse.InspectionPhotoResponse(photo.getId(), photo.getContenttype()));
        var order = db.select(WORKORDER.ID, WORKORDER.REFERENCE)
                .from(WORKORDER)
                .where(WORKORDER.ESTATEID.eq(row.getEstateid()).and(WORKORDER.SOURCEINSPECTIONID.eq(row.getId())))
                .fetchOne(record -> new InspectionResultResponse.InspectionWorkOrderResponse(
                        record.get(WORKORDER.ID), record.get(WORKORDER.REFERENCE)));
        return new InspectionResultResponse(
                row.getId(),
                row.getEstateid(),
                row.getAssetid(),
                row.getLocationid(),
                row.getLocationpath(),
                InspectionOutcome.valueOf(row.getOutcome()),
                row.getInspectedon(),
                row.getNotes(),
                row.getRecordedbyuserid(),
                row.getRecordedbyname(),
                row.getCreatedat(),
                photos,
                order);
    }
}
