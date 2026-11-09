package com.proj.server.report;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.proj.server.resident.ResidentReportException;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReportQueueCursorTests {
    private final UUID estateId = UUID.randomUUID();

    private String scope(String routingState) {
        return ReportQueueCursor.scope(estateId, null, null, null, null, true, ReportSort.URGENCY, routingState);
    }

    @Test
    void aCursorFromOneRoutingFilterIsRejectedUnderAnother() {
        var cursor = new ReportQueueCursor(false, 2, OffsetDateTime.parse("2026-11-01T00:00:00Z"), UUID.randomUUID())
                .encode(scope("NEEDS_REVIEW"));

        assertThrows(ResidentReportException.class, () -> ReportQueueCursor.decode(cursor, scope("DISMISSED")));
    }
}
