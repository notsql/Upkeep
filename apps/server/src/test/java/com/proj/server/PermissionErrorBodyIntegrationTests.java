package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Permission refusals keep the EstateError body ({ message }) on every endpoint moved onto permission codes. */
class PermissionErrorBodyIntegrationTests extends AssetHistoryTestSupport {
    @ParameterizedTest
    @ValueSource(
            strings = {
                "/assets",
                "/assets/{asset}/events",
                "/assets/{asset}/failure-risk",
                "/assets/{asset}/work-order-completions",
                "/assets/{asset}/devices",
                "/costs/top-assets",
                "/locations?includeInactive=true",
                "/inspection-list",
                "/asset-categories"
            })
    void refusedReadsExplainWhichPermissionIsMissing(String suffix) throws Exception {
        var path = path() + suffix.replace("{asset}", assetId.toString());
        var user = suffix.startsWith("/inspection") ? "member" : "crew";
        // Council view assets, so they list inactive locations; only a role with neither is refused.
        if (suffix.startsWith("/locations")) {
            person("estate-viewer", true);
            grant("estate-viewer", "VIEW_ESTATE");
            user = "estate-viewer";
        }
        read(user, get(path))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.startsWith("This estate permission is required")));
        read("outsider", get(path))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Estate not found."));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/locations/{location}/floors", "/assets/{asset}/assessments"})
    void refusedWritesExplainWhichPermissionIsMissing(String suffix) throws Exception {
        var path = path() + suffix.replace("{asset}", assetId.toString()).replace("{location}", locationId.toString());
        Map<String, Object> body = suffix.endsWith("/floors")
                ? Map.of("lowestFloor", 1, "highestFloor", 2)
                : Map.of("condition", "GOOD", "assessedOn", "2026-09-01", "notes", "Checked");
        send("member", post(path), body)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.startsWith("This estate permission is required")));
    }
}
