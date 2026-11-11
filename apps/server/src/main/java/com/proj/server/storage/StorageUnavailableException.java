package com.proj.server.storage;

/** Storage is not configured, cannot be reached, or cannot sign. Answered as 503 by {@link StorageExceptionHandler}. */
public class StorageUnavailableException extends RuntimeException {
    public StorageUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
