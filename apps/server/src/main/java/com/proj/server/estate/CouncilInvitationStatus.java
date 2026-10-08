package com.proj.server.estate;

public enum CouncilInvitationStatus {
    SENDING,
    PENDING,
    IN_APP,
    ACCEPTED,
    CANCELLED;

    public boolean matches(String value) {
        return name().equals(value);
    }

    public static boolean canAccept(String value) {
        return IN_APP.matches(value) || PENDING.matches(value);
    }

    public static boolean isOutstanding(String value) {
        return SENDING.matches(value) || canAccept(value);
    }
}
