package com.proj.server.routing;

/** A send that failed; {@code code} is the internal category stored on the work order, never provider text. */
public class WorkOrderSendException extends RuntimeException {
    private final String code;

    public WorkOrderSendException(String code, String message) {
        super(message);
        this.code = code;
    }

    public WorkOrderSendException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
