import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export function useEstateMembers(estateId: string, enabled: boolean) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [userId, "estate-members", estateId],
    enabled: ready && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/members",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useCouncilInvitation(estateId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["CouncilInvitationRequest"]
    ) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/council-invitations",
        { params: { path: { estateId } }, body }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [userId, "estate-invitations", estateId],
      }),
    onError: () =>
      client.invalidateQueries({
        queryKey: [userId, "estate-invitation-roles", estateId],
      }),
  });
}

export function useUpdateEstateRole(estateId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      body,
    }: {
      memberId: string;
      body: components["schemas"]["UpdateEstateRoleRequest"];
    }) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/members/{userId}/role",
        {
          params: { path: { estateId, userId: memberId } },
          body,
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      client.invalidateQueries({
        predicate: (query) => query.queryKey.includes(userId),
      }),
    onError: () =>
      client.invalidateQueries({
        predicate: (query) => query.queryKey.includes(userId),
      }),
  });
}

export function useTransferOwnership(estateId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (newOwnerUserId: string) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/ownership-transfer",
        {
          params: { path: { estateId } },
          body: { newOwnerUserId },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      client.invalidateQueries({
        predicate: (query) => query.queryKey.includes(userId),
      }),
  });
}

export function useAcceptCouncilInvitations() {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await api.POST(
        "/council-invitations/accept"
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      if (data.estateIds.length > 0) {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["estates", userId] }),
          client.invalidateQueries({ queryKey: [userId, "app-access"] }),
          client.invalidateQueries({ queryKey: [userId, "resident-context"] }),
          client.invalidateQueries({
            queryKey: [userId, "council-invitations"],
          }),
        ]);
      }
    },
  });
}

export function usePendingCouncilInvitations() {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [userId, "council-invitations"],
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/council-invitations");
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useAcceptInAppInvitation() {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      selection:
        | string
        | {
            invitationId: string;
            body: components["schemas"]["AcceptEstateInvitationRequest"];
          }
    ) => {
      const invitationId =
        typeof selection === "string" ? selection : selection.invitationId;
      const { data, error, response } = await api.POST(
        "/council-invitations/{invitationId}/accept",
        {
          params: { path: { invitationId } },
          ...(typeof selection === "string" ? {} : { body: selection.body }),
        }
      );
      if (error || !data) {
        if (response.status === 409 || response.status === 404) {
          await client.invalidateQueries({
            queryKey: [userId, "council-invitations"],
          });
        }
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [userId, "council-invitations"] }),
        client.invalidateQueries({ queryKey: ["estates", userId] }),
        client.invalidateQueries({ queryKey: [userId, "app-access"] }),
        client.invalidateQueries({ queryKey: [userId, "resident-context"] }),
      ]);
    },
  });
}

export function useOutstandingInvitations(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: [userId, "estate-invitations", estateId],
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/council-invitations",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useCancelCouncilInvitation(estateId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error, response } = await api.DELETE(
        "/estates/{estateId}/council-invitations/{invitationId}",
        { params: { path: { estateId, invitationId } } }
      );
      if (error || !response.ok) {
        throw estateError(error, response.status);
      }
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [userId, "estate-invitations", estateId],
      }),
  });
}

export function useRemoveEstateMember(estateId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error, response } = await api.DELETE(
        "/estates/{estateId}/members/{userId}",
        { params: { path: { estateId, userId: memberId } } }
      );
      if (error || !response.ok) {
        throw estateError(error, response.status);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: [userId, "estate-members", estateId],
        }),
        client.invalidateQueries({
          queryKey: [userId, "estate-invitations", estateId],
        }),
        client.invalidateQueries({ queryKey: ["estates", userId] }),
        client.invalidateQueries({ queryKey: [userId, "app-access"] }),
        client.invalidateQueries({ queryKey: [userId, "resident-context"] }),
      ]);
    },
  });
}

export function useEstateInvitationRoles(estateId: string) {
  const { userId, ready } = useAuthenticatedSession();
  const access = useAppAccess();
  const permission = access.data?.estates?.find(
    (estate) => estate.estateId === estateId
  );
  return useQuery({
    queryKey: [userId, "estate-invitation-roles", estateId],
    enabled:
      ready &&
      !access.isError &&
      !!(
        permission?.canInviteMembers ||
        permission?.canViewEstateInvitations ||
        permission?.canManageInvitationPermissions
      ),
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/invitation-roles",
        { params: { path: { estateId } }, signal }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
