package com.proj.server.report;

import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class DuplicateService {
    private final DuplicateRepository duplicates;

    public DuplicateService(DuplicateRepository duplicates) {
        this.duplicates = duplicates;
    }

    /** Runs inside the resident submission transaction, after the report is inserted and the estate is locked. */
    public void detect(UUID estateId, UUID reportId, UUID locationId, String title, String description) {
        var candidates = duplicates.candidates(estateId, reportId, locationId);
        DuplicateDetector.detect(title, description, candidates)
                .ifPresent(match -> duplicates.insertDetected(estateId, reportId, match));
    }
}
