import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const memberQueryKey = (organizationId: string) =>
  ["admin", "members", organizationId] as const;

// Local mutation arguments; API request/response types remain inferred.
interface RoleChange {
  membershipId: string;
  organizationId: string;
  role: string;
}

const ROLE_UPDATE_REASONS = new Set([
  "Estate must have at least 1 admin.",
  "You cannot remove your own admin role.",
]);

function roleUpdateError(error: unknown, status: number | undefined): Error {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : undefined;
  if (status === 409 && message && ROLE_UPDATE_REASONS.has(message)) {
    return new Error(`Couldn't update role: ${message}`);
  }
  return new Error("Couldn't update role. Try again.");
}

export function useAdminOrganizations() {
  return useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET(
        "/api/admin/users/organization/all",
        { signal }
      );

      if (error || !data) {
        throw new Error("Couldn't load organizations. Try again.");
      }

      return data;
    },
  });
}

export function useAdminMembers(organizationId: string) {
  return useQuery({
    queryKey: memberQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET(
        "/api/admin/users/organization/{organizationId}/members",
        {
          params: { path: { organizationId } },
          signal,
        }
      );

      if (error || !data) {
        throw new Error("Couldn't load members. Try again.");
      }

      return data;
    },
  });
}

export function useAdminOrganizationRoles(organizationId: string) {
  return useQuery({
    queryKey: ["admin", "roles", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET(
        "/api/admin/users/organization/{organizationId}/roles",
        {
          params: { path: { organizationId } },
          signal,
        }
      );

      if (error || !data) {
        throw new Error("Couldn't load roles. Try again.");
      }

      return data;
    },
  });
}

export function useAdminRoleUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, role }: RoleChange) => {
      const { error, response } = await api.PUT(
        "/api/admin/users/{membershipId}/role",
        {
          params: { path: { membershipId } },
          body: { roleSlugs: [role] },
        }
      );

      if (error) {
        throw roleUpdateError(error, response?.status);
      }
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: memberQueryKey(variables.organizationId),
        exact: true,
      }),
  });
}
