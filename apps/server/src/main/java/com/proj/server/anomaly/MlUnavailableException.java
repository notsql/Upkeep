package com.proj.server.anomaly;

/** apps/ml is unreachable, timed out, has no model loaded, or answered in an unexpected shape. */
class MlUnavailableException extends RuntimeException {
    MlUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
