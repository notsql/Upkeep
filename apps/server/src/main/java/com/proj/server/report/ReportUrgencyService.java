package com.proj.server.report;

import com.proj.server.resident.ResidentReportException;
import com.proj.server.workos.WorkOSService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ReportUrgencyService {
    private final EstateReportRepository estates;
    private final ReportUrgencyRepository reports;
    private final WorkOSService identity;
    private final TransactionTemplate transactions;

    public ReportUrgencyService(
            EstateReportRepository estates,
            ReportUrgencyRepository reports,
            WorkOSService identity,
            TransactionTemplate transactions) {
        this.estates = estates;
        this.reports = reports;
        this.identity = identity;
        this.transactions = transactions;
    }

    public void change(UUID estate, UUID report, String user, ChangeReportUrgencyRequest request) {
        request.validate();
        authorize(estate, user, false);
        if (reports.values(estate, report) == null) throw error(HttpStatus.NOT_FOUND, "Report not found.");
        // Provider latency must not hold the estate lock. Missing names are harmless.
        var name = identity.findDisplayName(user).orElse(null);
        transactions.executeWithoutResult(ignored -> {
            authorize(estate, user, true);
            var current = reports.values(estate, report);
            if (current == null) throw error(HttpStatus.NOT_FOUND, "Report not found.");
            if (current.version() != request.expectedVersion())
                throw error(HttpStatus.CONFLICT, "The report urgency changed. Reload and review before saving.");
            if (current.urgency() == request.urgency() && current.isSafety() == request.isSafety()) return;
            reports.change(estate, report, current, request, user, name);
        });
    }

    private void authorize(UUID estate, String user, boolean lock) {
        var row = estates.estate(estate, lock);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        var role = estates.role(estate, user, lock);
        if (!"MANAGER".equals(role)) {
            boolean known = role != null || user.equals(row.get("ownerUserId", String.class));
            throw error(
                    known ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND,
                    known ? "Manager membership required." : "Estate not found.");
        }
        if (row.get("deactivatedAt") != null) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
    }

    private static ResidentReportException error(HttpStatus status, String message) {
        return new ResidentReportException(status, message);
    }
}
