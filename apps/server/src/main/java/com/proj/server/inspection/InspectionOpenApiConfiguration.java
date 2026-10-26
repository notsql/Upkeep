package com.proj.server.inspection;

import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Schema;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class InspectionOpenApiConfiguration {
    @Bean
    OpenApiCustomizer inspectionWorkOrderNullability() {
        // OpenAPI 3.1: a nullable sibling of $ref still intersects the referenced object.
        // Express the actual wire contract as an object-or-null union for generated clients.
        return api -> {
            var result = api.getComponents().getSchemas().get("InspectionResultResponse");
            if (result == null) return;
            result.addProperty(
                    "workOrder",
                    new ComposedSchema()
                            .addAnyOfItem(new Schema<>().$ref("#/components/schemas/InspectionWorkOrderResponse"))
                            .addAnyOfItem(new Schema<>(io.swagger.v3.oas.models.SpecVersion.V31)
                                    .types(java.util.Set.of("null"))));
        };
    }
}
