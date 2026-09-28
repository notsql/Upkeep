package com.proj.server.workos;

import java.util.List;

public record Role(String id, String slug, String name, String description, List<String> permissions) {}
