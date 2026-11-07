package com.proj.server.report;

import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class DuplicateOpenApiConfiguration {
    /** Estate report schemas whose duplicateOf is null for a report without an active link (ID-74). */
    private static final List<String> SCHEMAS =
            List.of("EstateIssueReportSummaryResponse", "EstateIssueReportDetailResponse");

    @Bean
    OpenApiCustomizer duplicateOfNullability() {
        // OpenAPI 3.1: a nullable sibling of $ref still intersects the referenced object, so
        // generated clients type it as always present. Express it as an object-or-null union.
        return api -> SCHEMAS.forEach(name -> {
            var schema = api.getComponents().getSchemas().get(name);
            if (schema == null) return;
            schema.getProperties()
                    .put(
                            "duplicateOf",
                            new Schema<>()
                                    .oneOf(List.of(
                                            new Schema<>().$ref("#/components/schemas/DuplicateOf"),
                                            new Schema<>().types(Set.of("null")))));
        });
    }
}
