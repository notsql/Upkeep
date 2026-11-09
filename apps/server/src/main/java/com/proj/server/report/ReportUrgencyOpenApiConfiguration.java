package com.proj.server.report;

import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.Set;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ReportUrgencyOpenApiConfiguration {
    @Bean
    OpenApiCustomizer reportUrgencyNullability() {
        return api -> {
            var detail = api.getComponents().getSchemas().get("EstateIssueReportDetailResponse");
            if (detail == null) return;
            // An object $ref with a nullable sibling still intersects the referenced schema.
            // Keep the generated client faithful to the null returned before any change.
            detail.getProperties()
                    .put(
                            "lastUrgencyChange",
                            new Schema<>()
                                    .oneOf(List.of(
                                            new Schema<>().$ref("#/components/schemas/ReportUrgencyChange"),
                                            new Schema<>().types(Set.of("null")))));
        };
    }
}
