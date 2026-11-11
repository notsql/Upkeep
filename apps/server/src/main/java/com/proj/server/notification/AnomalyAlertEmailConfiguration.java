package com.proj.server.notification;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AnomalyAlertEmailConfiguration {
    /** Unusual-readings alert email, off the scoring threads so a slow identity lookup never delays scoring. */
    @Bean
    public ThreadPoolTaskExecutor anomalyAlertEmailExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setThreadNamePrefix("anomaly-alert-email-");
        return executor;
    }
}
