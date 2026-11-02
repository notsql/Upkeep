package com.proj.server.reading;

import jakarta.servlet.http.HttpServletRequest;
import java.util.concurrent.Callable;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.async.CallableProcessingInterceptor;
import org.springframework.web.context.request.async.WebAsyncUtils;

/** Reserve capacity before the streaming response is handed to MVC. */
@Component
public class ReadingExportAdmission {
    private final Semaphore slots = new Semaphore(2);
    private final ThreadPoolTaskExecutor executor;

    public ReadingExportAdmission(@Qualifier("readingExportExecutor") ThreadPoolTaskExecutor executor) {
        this.executor = executor;
    }

    Lease acquire(HttpServletRequest request) {
        if (executor.getActiveCount() >= 2 || !slots.tryAcquire())
            throw new ReadingException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Reading exports are busy. Please retry shortly.");
        var lease = new Lease(slots);
        WebAsyncUtils.getAsyncManager(request).registerCallableInterceptor(lease, new CallableProcessingInterceptor() {
            @Override
            public <T> void afterCompletion(NativeWebRequest request, Callable<T> task) {
                lease.close();
            }
        });
        return lease;
    }

    static final class Lease implements AutoCloseable {
        private final Semaphore slots;
        private final AtomicBoolean closed = new AtomicBoolean();

        Lease(Semaphore slots) {
            this.slots = slots;
        }

        @Override
        public void close() {
            if (closed.compareAndSet(false, true)) slots.release();
        }
    }
}
