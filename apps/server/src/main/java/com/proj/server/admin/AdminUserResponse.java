package com.proj.server.admin;

import java.util.List;

public record AdminUserResponse(
        String membershipId, String userId, String name, String email, String joined, List<String> roleSlugs) {}
