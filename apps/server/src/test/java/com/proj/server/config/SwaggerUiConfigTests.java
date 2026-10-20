package com.proj.server.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.ClassPathResource;

class SwaggerUiConfigTests {

    @Test
    void packagedConfigKeepsSwaggerUiOff() throws Exception {
        // The jar deployed to Cloud Run runs on application.yaml alone; only the
        // Maven spring-boot:run/start config turns Swagger UI on for local runs.
        var sources = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yaml"));

        assertThat(sources.getFirst().getProperty("springdoc.swagger-ui.enabled"))
                .hasToString("false");
    }
}
