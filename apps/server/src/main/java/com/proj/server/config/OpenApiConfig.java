package com.proj.server.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The spec produced here is the contract: `pnpm api:generate` exports it to
 * packages/api/openapi.json and regenerates the typed client the web app uses.
 * Anything not described by an annotation will not exist for the frontend.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    OpenAPI apiDefinition() {
        return new OpenAPI()
                .info(new Info().title("proj API").version("v1"))
                .components(new Components()
                        .addSecuritySchemes(
                                BEARER_SCHEME,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
    }

    @Bean
    OpenApiCustomizer nullableResidentEstate() {
        return openApi -> {
            var context = openApi.getComponents().getSchemas().get("ResidentContextResponse");
            if (context != null) {
                // Swagger's nullable annotation places `type: null` beside a
                // $ref in OpenAPI 3.1, which generators read as a plain ref.
                context.getProperties()
                        .put(
                                "estate",
                                new Schema<>()
                                        .oneOf(List.of(
                                                new Schema<>().$ref("#/components/schemas/EstateLabel"),
                                                new Schema<>().types(Set.of("null")))));
            }
            var access = openApi.getComponents().getSchemas().get("AppAccessResponse");
            if (access != null) {
                access.getProperties()
                        .put(
                                "residentEstate",
                                new Schema<>()
                                        .oneOf(List.of(
                                                new Schema<>().$ref("#/components/schemas/EstateLabel"),
                                                new Schema<>().types(Set.of("null")))));
            }
            var sensor = openApi.getComponents().getSchemas().get("SensorMonitoringResponse");
            if (sensor != null) {
                sensor.getProperties()
                        .put(
                                "flatline",
                                new Schema<>()
                                        .oneOf(List.of(
                                                new Schema<>().$ref("#/components/schemas/FlatlineEvidenceResponse"),
                                                new Schema<>().types(Set.of("null")))));
                sensor.getProperties()
                        .put(
                                "pause",
                                new Schema<>()
                                        .oneOf(List.of(
                                                new Schema<>().$ref("#/components/schemas/FlatlinePauseResponse"),
                                                new Schema<>().types(Set.of("null")))));
            }
        };
    }
}
