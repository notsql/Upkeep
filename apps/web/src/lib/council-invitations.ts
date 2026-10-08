import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  });
}

export function useInvitationPermission(estateId: string) {
  const { userId } = useEstateSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      memberId,
      body,
    }: {
      memberId: string;
      body: components["schemas"]["InvitationPermissionRequest"];
    }) => {
      const { error, response } = await api.PUT(
        "/estates/{estateId}/members/{userId}/invitation-permission",
        { params: { path: { estateId, userId: memberId } }, body }
      );
      if (error) {
        throw estateError(error, response.status);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: [userId, "estate-members", estateId],
        }),
        client.invalidateQueries({
          queryKey: ["estates", userId, "details", estateId],
        }),
      ]);
    },
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
    mutationFn: async (invitationId: string) => {
      const { data, error, response } = await api.POST(
        "/council-invitations/{invitationId}/accept",
        {
          params: { path: { invitationId } },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [userId, "council-invitations"] }),
        client.invalidateQueries({ queryKey: ["estates", userId] }),
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
      ]);
    },
  });
}
