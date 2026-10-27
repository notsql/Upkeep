package com.proj.server.routing;

/** A classification attempt that produced no usable answer; the job retries it. */
public class ClassificationFailedException extends RuntimeException {
    public ClassificationFailedException(String message) {
        super(message);
    }

    public ClassificationFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
