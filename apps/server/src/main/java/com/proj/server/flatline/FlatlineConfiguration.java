package com.proj.server.flatline;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class FlatlineConfiguration {
    @Bean
    Clock flatlineClock() {
        return Clock.systemUTC();
    }
}
