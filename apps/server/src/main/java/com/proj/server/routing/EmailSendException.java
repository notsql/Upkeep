package com.proj.server.routing;

/** A send that failed; {@code code} is the internal category stored on the dispatch, never provider text. */
public class EmailSendException extends RuntimeException {
    private final String code;

    public EmailSendException(String code, String message) {
        super(message);
        this.code = code;
    }

    public EmailSendException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
