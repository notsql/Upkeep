package com.proj.server;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * A UTC clock a test moves by hand. Unlike a Mockito mock it has no stubbing step, so the scheduled jobs reading the
 * shared Clock bean from other threads cannot race a test that changes the time. Import {@link Config} and autowire it.
 */
final class MutableClock extends Clock {
    private volatile Instant now = Instant.EPOCH;

    void set(Instant instant) {
        now = instant;
    }

    @Override
    public Instant instant() {
        return now;
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return Clock.fixed(now, zone);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Config {
        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock();
        }
    }
}
