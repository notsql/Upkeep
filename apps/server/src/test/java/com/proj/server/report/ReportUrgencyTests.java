package com.proj.server.report;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.proj.server.resident.ResidentReportException;
import org.junit.jupiter.api.Test;

class ReportUrgencyTests {
    @Test
    void urgentSortsAboveHighMediumAndLow() {
        assertTrue(ReportUrgency.URGENT.rank() > ReportUrgency.HIGH.rank());
        assertTrue(ReportUrgency.HIGH.rank() > ReportUrgency.MEDIUM.rank());
        assertTrue(ReportUrgency.MEDIUM.rank() > ReportUrgency.LOW.rank());
    }

    @Test
    void safetyCannotBeSavedWithRoutineUrgency() {
        var request = new ChangeReportUrgencyRequest(ReportUrgency.HIGH, true, 0);
        assertThrows(ResidentReportException.class, request::validate);
    }

    @Test
    void safetyMayBeExplicitlyRemovedWithALowerUrgency() {
        var request = new ChangeReportUrgencyRequest(ReportUrgency.MEDIUM, false, 3);
        request.validate();
        assertFalse(request.isSafety());
    }
}
