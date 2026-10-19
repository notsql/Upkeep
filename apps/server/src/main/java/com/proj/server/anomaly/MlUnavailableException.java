package com.proj.server.anomaly;

/** Running the anomaly model failed or produced output in an unexpected shape. */
public class MlUnavailableException extends RuntimeException {
    public MlUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
