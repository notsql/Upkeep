package com.proj.server.assethistory;

import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class AssetHistoryOpenApiConfiguration {
    @Bean
    OpenApiCustomizer historyDetailVariants() {
        return api -> {
            var schemas = api.getComponents().getSchemas();
            var details = schemas.get("AssetHistoryDetails");
            if (details == null) return;
            // A union member must not inherit the union itself: that creates a
            // circular allOf/oneOf contract. Each record is a complete payload.
            for (var mapping : details.getDiscriminator().getMapping().entrySet()) {
                var variant = schemas.get(mapping.getValue().substring("#/components/schemas/".length()));
                if (variant.getAllOf() != null) {
                    for (var member : variant.getAllOf()) {
                        if (member instanceof Schema<?> schema && schema.getProperties() != null)
                            variant.setProperties(schema.getProperties());
                    }
                    variant.setAllOf(null);
                }
                variant.getProperties()
                        .put(
                                "kind",
                                new Schema<String>(io.swagger.v3.oas.models.SpecVersion.V31)
                                        .types(Set.of("string"))
                                        ._enum(List.of(mapping.getKey())));
            }
        };
    }
}
