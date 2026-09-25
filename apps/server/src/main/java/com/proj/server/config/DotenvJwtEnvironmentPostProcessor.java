package com.proj.server.config;

import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/** Maps dotenv file keys, which do not get OS environment relaxed binding. */
public class DotenvJwtEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> aliases = new HashMap<>();
        copyIfMissing(environment, aliases, "issuer-uri", "ISSUER_URI");
        copyIfMissing(environment, aliases, "audiences", "AUDIENCES");
        if (!aliases.isEmpty()) {
            environment.getPropertySources().addLast(new MapPropertySource("dotenv-jwt", aliases));
        }
    }

    private static void copyIfMissing(
            ConfigurableEnvironment environment, Map<String, Object> aliases, String property, String variable) {
        String canonical = "spring.security.oauth2.resourceserver.jwt." + property;
        if (environment.containsProperty(canonical)) {
            return;
        }
        String value = environment.getProperty("SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_" + variable);
        if (value != null && !value.isBlank()) {
            aliases.put(canonical, value);
        }
    }

    @Override
    public int getOrder() {
        // Config data must have imported .env before aliases are evaluated.
        return ConfigDataEnvironmentPostProcessor.ORDER + 1;
    }
}
