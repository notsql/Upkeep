package com.proj.server.workorder;

import static com.proj.server.db.tables.Document.DOCUMENT;
import static com.proj.server.db.tables.Documentworkorderevent.DOCUMENTWORKORDEREVENT;
import static com.proj.server.db.tables.Workorder.WORKORDER;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.db.tables.records.DocumentworkordereventRecord;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class WorkOrderDocumentRepository {
    private final DSLContext db;

    public WorkOrderDocumentRepository(DSLContext db) {
        this.db = db;
    }

    String reference(UUID estate, UUID id) {
        if (id == null) return null;
        return db.select(WORKORDER.REFERENCE)
                .from(WORKORDER)
                .where(WORKORDER.ESTATEID.eq(estate).and(WORKORDER.ID.eq(id)))
                .fetchOne(WORKORDER.REFERENCE);
    }

    DocumentworkordereventRecord latest(UUID document) {
        return db.selectFrom(DOCUMENTWORKORDEREVENT)
                .where(DOCUMENTWORKORDEREVENT.DOCUMENTID.eq(document))
                .orderBy(DOCUMENTWORKORDEREVENT.ASSOCIATIONVERSION.desc())
                .limit(1)
                .fetchOne();
    }

    void change(DocumentRecord document, UUID target, String user, String name, String reason, OffsetDateTime now) {
        int version = document.getWorkorderassociationversion() + 1;
        db.insertInto(DOCUMENTWORKORDEREVENT)
                .set(DOCUMENTWORKORDEREVENT.ID, UUID.randomUUID())
                .set(DOCUMENTWORKORDEREVENT.DOCUMENTID, document.getId())
                .set(DOCUMENTWORKORDEREVENT.ESTATEID, document.getEstateid())
                .set(DOCUMENTWORKORDEREVENT.FROMWORKORDERID, document.getWorkorderid())
                .set(DOCUMENTWORKORDEREVENT.TOWORKORDERID, target)
                .set(DOCUMENTWORKORDEREVENT.ASSOCIATIONVERSION, version)
                .set(DOCUMENTWORKORDEREVENT.CORRECTIONREASON, reason)
                .set(DOCUMENTWORKORDEREVENT.CHANGEDBYUSERID, user)
                .set(DOCUMENTWORKORDEREVENT.CHANGEDBYNAME, name)
                .set(DOCUMENTWORKORDEREVENT.CHANGEDAT, now)
                .execute();
        db.update(DOCUMENT)
                .set(DOCUMENT.WORKORDERID, target)
                .set(DOCUMENT.WORKORDERASSOCIATIONVERSION, version)
                .where(DOCUMENT.ID.eq(document.getId()))
                .execute();
    }

    List<DocumentWorkOrderEventResponse> history(UUID estate, UUID document, int after, int limit) {
        var e = DOCUMENTWORKORDEREVENT;
        var from = WORKORDER.as("from_order");
        var to = WORKORDER.as("to_order");
        return db.select(e.asterisk(), from.REFERENCE.as("fromReference"), to.REFERENCE.as("toReference"))
                .from(e)
                .leftJoin(from)
                .on(from.ID.eq(e.FROMWORKORDERID).and(from.ESTATEID.eq(e.ESTATEID)))
                .leftJoin(to)
                .on(to.ID.eq(e.TOWORKORDERID).and(to.ESTATEID.eq(e.ESTATEID)))
                .where(e.ESTATEID.eq(estate).and(e.DOCUMENTID.eq(document)).and(e.ASSOCIATIONVERSION.gt(after)))
                .orderBy(e.ASSOCIATIONVERSION)
                .limit(limit)
                .fetch(row -> new DocumentWorkOrderEventResponse(
                        row.get(e.ID),
                        row.get(e.FROMWORKORDERID),
                        row.get("fromReference", String.class),
                        row.get(e.TOWORKORDERID),
                        row.get("toReference", String.class),
                        row.get(e.ASSOCIATIONVERSION),
                        row.get(e.CORRECTIONREASON),
                        row.get(e.CHANGEDBYNAME),
                        row.get(e.CHANGEDAT)));
    }

    List<DocumentRecord> attachments(UUID estate, UUID order, OffsetDateTime before, UUID beforeId, int limit) {
        var condition =
                DOCUMENT.ESTATEID.eq(estate).and(DOCUMENT.WORKORDERID.eq(order)).and(DOCUMENT.DELETEDAT.isNull());
        if (before != null)
            condition = condition.and(DOCUMENT.CREATEDAT
                    .lt(before)
                    .or(DOCUMENT.CREATEDAT.eq(before).and(DOCUMENT.ID.lt(beforeId))));
        return db.selectFrom(DOCUMENT)
                .where(condition)
                .orderBy(DOCUMENT.CREATEDAT.desc(), DOCUMENT.ID.desc())
                .limit(limit)
                .fetch();
    }
}
