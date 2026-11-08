package com.proj.server.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AnomalyScoringConfiguration {
    /** Scoring passes, off the device request threads. Passes for one asset still wait on its advisory lock. */
    @Bean
    public ThreadPoolTaskExecutor anomalyScoringExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setThreadNamePrefix("anomaly-scoring-");
        return executor;
    }
}
