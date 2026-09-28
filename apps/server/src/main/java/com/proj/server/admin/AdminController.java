package com.proj.server.admin;

import com.proj.server.workos.Organization;
import com.proj.server.workos.Role;
import com.proj.server.workos.UserRoles;
import com.proj.server.workos.WorkOSService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
public class AdminController {
    private final WorkOSService workOSService;

    public AdminController(WorkOSService workOSService) {
        this.workOSService = workOSService;
    }

    @GetMapping("/organization/all")
    public List<Organization> getOrganizations() {
        return workOSService.getOrganizations();
    }

    @GetMapping("/organization/{organizationId}/roles")
    public List<Role> getOrganizationRoles(@PathVariable String organizationId) {
        return workOSService.getOrganizationRoles(organizationId);
    }

    @GetMapping("/organization/{organizationId}/members")
    public List<AdminUserResponse> getMembers(@PathVariable String organizationId) {
        return workOSService.getMembers(organizationId);
    }

    @PutMapping("/{membershipId}/role")
    public UserRoles updateRole(@PathVariable String membershipId, @RequestBody UserRoles request) {
        return workOSService.updateRole(membershipId, request);
    }
}
