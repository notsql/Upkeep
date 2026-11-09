package com.proj.server.assethistory;

import com.proj.server.asset.AssetStatus;
import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.estate.EstatePermissions;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class AssetHistoryService {
    private static final ZoneId SINGAPORE = ZoneId.of("Asia/Singapore");
    private final DSLContext db;
    private final AssetHistoryRepository repository;

    public AssetHistoryService(DSLContext db, AssetHistoryRepository repository) {
        this.db = db;
        this.repository = repository;
    }

    private EstatePermissions.Authority authority(UUID estate, String user) {
        var access = EstatePermissions.authority(db, estate, user, false);
        if ("RESIDENT".equals(access.role())
                || !(user.equals(access.estate().getOwneruserid()) || "COUNCIL".equals(access.role())))
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Owner or Council access is required to read asset history.");
        return access;
    }

    public AssetHistoryAssetPageResponse assets(
            UUID estate, String user, String q, AssetStatus status, String cursor, int limit) {
        authority(estate, user);
        validateLimit(limit);
        String query = q == null ? "" : q.strip();
        if (query.length() > 255) throw AssetHistoryCursor.invalid();
        String normalized = query.toLowerCase(Locale.ROOT);
        String reference = null;
        UUID after = null;
        if (cursor != null) {
            var parts = AssetHistoryCursor.decode(cursor, 2, "assets-v1", estate.toString(), normalized, status.name());
            reference = parts[0];
            after = uuid(parts[1]);
            if (reference.isBlank()) throw AssetHistoryCursor.invalid();
        }
        var rows = repository.assets(estate, null, query, status, reference, after, limit + 1);
        var items = rows.stream().limit(limit).toList();
        String next = null;
        if (rows.size() > limit) {
            var last = items.getLast();
            next = AssetHistoryCursor.encode(
                    "assets-v1",
                    estate.toString(),
                    normalized,
                    status.name(),
                    last.reference(),
                    last.id().toString());
        }
        return new AssetHistoryAssetPageResponse(items, next);
    }

    public AssetHistoryPageResponse history(
            UUID estate, UUID asset, String user, String cursor, int limit, String from, String to) {
        var access = authority(estate, user);
        validateLimit(limit);
        var fromDate = date(from);
        var toDate = date(to);
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) throw invalidDates();
        String rangeFrom = fromDate == null ? "" : fromDate.toString();
        String rangeTo = toDate == null ? "" : toDate.toString();
        var summary = repository.assets(estate, asset, "", AssetStatus.ALL, null, null, 1).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found."));
        AssetHistoryRepository.Key before = null;
        if (cursor != null) {
            var parts = AssetHistoryCursor.decode(
                    cursor, 3, "history-v2", estate.toString(), asset.toString(), rangeFrom, rangeTo);
            try {
                before = new AssetHistoryRepository.Key(
                        OffsetDateTime.parse(parts[0]),
                        AssetHistoryEntryResponse.Kind.valueOf(parts[1]).name(),
                        uuid(parts[2]));
            } catch (IllegalArgumentException | java.time.DateTimeException error) {
                throw AssetHistoryCursor.invalid();
            }
        }
        boolean documents = access.has(EstatePermissionCode.VIEW_DOCUMENTS);
        var keys = repository.keys(
                estate,
                asset,
                documents,
                before,
                fromDate == null ? null : fromDate.atStartOfDay(SINGAPORE).toOffsetDateTime(),
                toDate == null
                        ? null
                        : toDate.plusDays(1).atStartOfDay(SINGAPORE).toOffsetDateTime(),
                limit + 1);
        var page = keys.stream().limit(limit).toList();
        String next = null;
        if (keys.size() > limit) {
            var last = page.getLast();
            next = AssetHistoryCursor.encode(
                    "history-v2",
                    estate.toString(),
                    asset.toString(),
                    rangeFrom,
                    rangeTo,
                    last.time().toString(),
                    last.kind(),
                    last.id().toString());
        }
        boolean sourceLinks =
                !"RESIDENT".equals(access.role()) && user.equals(access.estate().getOwneruserid());
        return new AssetHistoryPageResponse(summary, repository.entries(estate, page, sourceLinks), next, documents);
    }

    private static LocalDate date(String value) {
        if (value == null) return null;
        if (!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw invalidDates();
        try {
            var parsed = LocalDate.parse(value);
            if (parsed.getYear() < 1) throw invalidDates();
            return parsed;
        } catch (DateTimeException error) {
            throw invalidDates();
        }
    }

    private static ResponseStatusException invalidDates() {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "Choose valid history dates (YYYY-MM-DD), with From on or before To.");
    }

    private static UUID uuid(String value) {
        try {
            if (value.length() != 36) throw AssetHistoryCursor.invalid();
            return UUID.fromString(value);
        } catch (IllegalArgumentException error) {
            throw AssetHistoryCursor.invalid();
        }
    }

    private static void validateLimit(int limit) {
        if (limit < 1 || limit > 100) throw AssetHistoryCursor.invalid();
    }
}
