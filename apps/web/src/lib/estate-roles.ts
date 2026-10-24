import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { estateError } from "@/lib/estates";

export type EstateRoleDefinition =
  components["schemas"]["EstateRoleDefinitionResponse"];
export type EstatePermission =
  components["schemas"]["EstatePermissionResponse"];
export type EstatePermissionCode = EstatePermission["code"];

export function useEstateRoleAccess(estateId: string) {
  const access = useAppAccess();
  const session = useAuthenticatedSession();
  const estate = access.data?.estates?.find(
    (item) => item.estateId === estateId
  );
  return {
    access,
    estate,
    ...session,
    allowed:
      session.ready && !access.isError && estate?.canViewEstateRoles === true,
  };
}

export function useEstateRolePermissions(estateId: string) {
  const { userId, allowed } = useEstateRoleAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-role-permissions", estateId],
    enabled: allowed,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/role-permissions",
        { params: { path: { estateId } }, signal }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useEstateRoleDefinitions(estateId: string, enabled = true) {
  const { userId, allowed } = useEstateRoleAccess(estateId);
  return useQuery({
    queryKey: [userId, "estate-roles", estateId],
    enabled: allowed && enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/roles",
        { params: { path: { estateId } }, signal }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

function useRefreshEstateRoleAccess() {
  const client = useQueryClient();
  const { userId } = useAuthenticatedSession();
  return () =>
    client.invalidateQueries({
      predicate: (query) => query.queryKey.includes(userId),
    });
}

export function useCreateEstateRole(estateId: string) {
  const refresh = useRefreshEstateRoleAccess();
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["CreateEstateRoleRequest"]
    ) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/roles",
        { params: { path: { estateId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    retry: false,
    onSuccess: refresh,
    onError: refresh,
  });
}

export function useUpdateEstateRoleDefinition(estateId: string) {
  const refresh = useRefreshEstateRoleAccess();
  return useMutation({
    mutationFn: async ({
      roleId,
      body,
    }: {
      roleId: string;
      body: components["schemas"]["UpdateEstateRoleDefinitionRequest"];
    }) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/roles/{roleId}",
        { params: { path: { estateId, roleId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: refresh,
    onError: refresh,
  });
}

export function useDeleteEstateRole(estateId: string) {
  const refresh = useRefreshEstateRoleAccess();
  return useMutation({
    mutationFn: async (roleId: string) => {
      const { error, response } = await api.DELETE(
        "/estates/{estateId}/roles/{roleId}",
        { params: { path: { estateId, roleId } } }
      );
      if (error || !response.ok) {
        throw estateError(error, response.status);
      }
    },
    onSuccess: refresh,
    onError: refresh,
  });
}
