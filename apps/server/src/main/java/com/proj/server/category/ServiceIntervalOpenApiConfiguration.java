package com.proj.server.category;

import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ServiceIntervalOpenApiConfiguration {
    /** Nullable object properties of ID-81, by schema, then property, then referenced schema. */
    private static final Map<String, Map<String, String>> NULLABLE = Map.of(
            "SetServiceIntervalRequest", Map.of("interval", "ServiceInterval"),
            "IntervalChangeResponse", Map.of("interval", "ServiceInterval"),
            "EstateAssetCategoryResponse",
                    Map.of("serviceInterval", "ServiceInterval", "lastIntervalChange", "IntervalChangeResponse"),
            "AssetServiceIntervalResponse",
                    Map.of(
                            "effective", "ServiceInterval",
                            "override", "ServiceInterval",
                            "categoryInterval", "ServiceInterval",
                            "lastOverrideChange", "IntervalChangeResponse"));

    @Bean
    OpenApiCustomizer serviceIntervalNullability() {
        // OpenAPI 3.1: a nullable sibling of $ref still intersects the referenced object.
        // Express the actual wire contract as an object-or-null union for generated clients.
        return api -> NULLABLE.forEach((name, properties) -> {
            var schema = api.getComponents().getSchemas().get(name);
            if (schema == null) return;
            properties.forEach((property, ref) -> schema.getProperties()
                    .put(
                            property,
                            new Schema<>()
                                    .oneOf(List.of(
                                            new Schema<>().$ref("#/components/schemas/" + ref),
                                            new Schema<>().types(Set.of("null"))))));
        });
    }
}
