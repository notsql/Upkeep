package com.proj.server.estate;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class CouncilInvitationStatusTests {
    @ParameterizedTest
    @CsvSource({
        "SENDING, false",
        "PENDING, true",
        "IN_APP, true",
        "ACCEPTED, false",
        "CANCELLED, false",
        "UNRECOGNIZED, false"
    })
    void onlyDispatchedInvitationsCanBeAccepted(String status, boolean acceptable) {
        assertEquals(acceptable, CouncilInvitationStatus.canAccept(status));
    }

    @ParameterizedTest
    @CsvSource({
        "SENDING, true",
        "PENDING, true",
        "IN_APP, true",
        "ACCEPTED, false",
        "CANCELLED, false",
        "UNRECOGNIZED, false"
    })
    void onlyUnconsumedInvitationAttemptsAreOutstanding(String status, boolean outstanding) {
        assertEquals(outstanding, CouncilInvitationStatus.isOutstanding(status));
    }
}
