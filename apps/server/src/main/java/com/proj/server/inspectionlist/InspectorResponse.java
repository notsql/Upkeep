package com.proj.server.inspectionlist;

import io.swagger.v3.oas.annotations.media.Schema;

/** A current member who can record inspections in the estate. */
@Schema(requiredProperties = {"userId", "name", "roleName"})
public record InspectorResponse(String userId, String name, String roleName) {}
