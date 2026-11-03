package com.proj.server.inspectionlist;

import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class InspectionListOpenApiConfiguration {
    /** Nullable object properties of InspectionCheckResponse, by property, then referenced schema. */
    private static final Map<String, String> NULLABLE = Map.of(
            "level", "InspectionLocationResponse",
            "interval", "ServiceInterval",
            "result", "CheckResultResponse");

    @Bean
    OpenApiCustomizer inspectionListNullability() {
        // OpenAPI 3.1: a nullable sibling of $ref still intersects the referenced object.
        // Express the actual wire contract as an object-or-null union for generated clients.
        return api -> {
            var schema = api.getComponents().getSchemas().get("InspectionCheckResponse");
            if (schema == null) return;
            NULLABLE.forEach((property, ref) -> schema.getProperties()
                    .put(
                            property,
                            new Schema<>()
                                    .oneOf(List.of(
                                            new Schema<>().$ref("#/components/schemas/" + ref),
                                            new Schema<>().types(Set.of("null"))))));
        };
    }
}
