import type { components } from "@proj/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";

export type InspectionResult =
  components["schemas"]["InspectionResultResponse"];
export type InspectionAsset = components["schemas"]["InspectionAssetResponse"];
export type InspectionInput = Omit<
  components["schemas"]["CreateInspectionRequest"],
  "photos"
> & { photos: File[] };

export class InspectionRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function useInspectionAccess(estateId: string) {
  const session = useAuthenticatedSession();
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const valid = session.ready && !access.isError;
  return {
    userId: session.userId,
    canView: valid && !!permission?.canViewInspectionResults,
    canCreate: valid && !!permission?.canCreateInspectionResults,
    canViewAssets: valid && !!permission?.canViewAssets,
    canCreateWorkOrders: valid && !!permission?.canCreateWorkOrders,
    estateName: permission?.estateName,
    pending: !session.ready || access.isPending,
  };
}

function useFailure(userId: string | undefined) {
  const client = useQueryClient();
  return (error: unknown, status: number, fallback: string): never => {
    if ([401, 403, 404].includes(status)) {
      client.invalidateQueries({ queryKey: [userId, "app-access"] });
    }
    const message =
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : fallback;
    throw new InspectionRequestError(message, status);
  };
}

export function useInspectionAsset(estateId: string, assetId: string) {
  const access = useInspectionAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [access.userId, "inspection-assets", estateId, "detail", assetId],
    enabled: access.canView && !!assetId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/inspection-assets/{assetId}",
        { params: { path: { estateId, assetId } }, signal }
      );
      if (error || !data) {
        return fail(error, response.status, "Asset context is unavailable.");
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}

export function useInspectionAssets(
  estateId: string,
  q?: string,
  cursor?: string
) {
  const access = useInspectionAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [access.userId, "inspection-assets", estateId, "list", q, cursor],
    enabled: access.canView,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/inspection-assets",
        {
          params: { path: { estateId }, query: { q, cursor, limit: 20 } },
          signal,
        }
      );
      if (error || !data) {
        return fail(
          error,
          response.status,
          "Inspection assets are unavailable."
        );
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}

export function useInspectionResults(
  estateId: string,
  assetId: string,
  cursor?: string,
  enabled = true
) {
  const access = useInspectionAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [
      access.userId,
      "inspection-results",
      estateId,
      assetId,
      "list",
      cursor,
    ],
    enabled: enabled && access.canView && !!assetId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/inspections",
        {
          params: { path: { estateId, assetId }, query: { cursor, limit: 20 } },
          signal,
        }
      );
      if (error || !data) {
        return fail(
          error,
          response.status,
          "Inspection history is unavailable."
        );
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}

export function useInspectionResult(
  estateId: string,
  assetId: string,
  inspectionId: string
) {
  const access = useInspectionAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [
      access.userId,
      "inspection-results",
      estateId,
      assetId,
      "detail",
      inspectionId,
    ],
    enabled: access.canView && !!assetId && !!inspectionId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}",
        { params: { path: { estateId, assetId, inspectionId } }, signal }
      );
      if (error || !data) {
        return fail(
          error,
          response.status,
          "Inspection result is unavailable."
        );
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}

export function useInspectionSource(estateId: string, inspectionId: string) {
  const access = useInspectionAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [access.userId, "inspection-source", estateId, inspectionId],
    enabled: access.canView && !!inspectionId,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/inspection-results/{inspectionId}",
        { params: { path: { estateId, inspectionId } }, signal }
      );
      if (error || !data) {
        return fail(
          error,
          response.status,
          "Source inspection is unavailable."
        );
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}

export function useCreateInspection(estateId: string, assetId: string) {
  const access = useInspectionAccess(estateId);
  const client = useQueryClient();
  const fail = useFailure(access.userId);
  return useMutation({
    retry: false,
    mutationFn: async (input: InspectionInput) => {
      if (!access.canCreate) {
        return fail(undefined, 403, "Inspection recording is unavailable.");
      }
      const body = new FormData();
      body.append("outcome", input.outcome);
      body.append("inspectedOn", input.inspectedOn);
      body.append("expectedLocationId", input.expectedLocationId);
      if (input.notes?.trim()) {
        body.append("notes", input.notes.trim());
      }
      for (const photo of input.photos) {
        body.append("photos", photo);
      }
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/assets/{assetId}/inspections",
        { params: { path: { estateId, assetId } }, body: body as never }
      );
      if (error || !data) {
        return fail(
          error,
          response.status,
          "Unable to confirm the save. Refresh inspection history before submitting again."
        );
      }
      return data;
    },
    onSuccess: async (data) => {
      client.setQueryData(
        [
          access.userId,
          "inspection-results",
          estateId,
          assetId,
          "detail",
          data.id,
        ],
        data
      );
      await Promise.all([
        client.invalidateQueries({
          queryKey: [
            access.userId,
            "inspection-results",
            estateId,
            assetId,
            "list",
          ],
        }),
        client.invalidateQueries({
          queryKey: [access.userId, "inspection-assets", estateId],
        }),
        client.invalidateQueries({
          queryKey: ["estates", access.userId, "assets", estateId],
        }),
      ]);
    },
  });
}

export function useInspectionPhoto(
  estateId: string,
  assetId: string,
  inspectionId: string,
  photoId: string
) {
  const access = useInspectionAccess(estateId);
  const fail = useFailure(access.userId);
  const query = useQuery({
    queryKey: [
      access.userId,
      "inspection-results",
      estateId,
      assetId,
      "photo",
      inspectionId,
      photoId,
    ],
    enabled: access.canView,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}",
        {
          params: { path: { estateId, assetId, inspectionId, photoId } },
          parseAs: "blob",
          signal,
        }
      );
      if (error || !data) {
        return fail(error, response.status, "Inspection photo is unavailable.");
      }
      return data;
    },
  });
  return {
    ...query,
    data: access.canView && !query.isError ? query.data : undefined,
  };
}
