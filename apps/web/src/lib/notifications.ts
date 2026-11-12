import type { components } from "@proj/api/schema";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthenticatedSession } from "@/lib/access";
import { api } from "@/lib/api";
import { estateError } from "@/lib/estates";

export type Notification = components["schemas"]["NotificationResponse"];
export type NotificationType = Notification["type"];
export type NotificationSettings =
  components["schemas"]["NotificationSettingsResponse"];

export const NOTIFICATION_PAGE_SIZE = 20;
const COUNT_REFRESH_MS = 60_000;

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ANOMALY: "Unusual readings",
  SERVICE_DUE: "Service due",
  REPAIR_PREDICTED: "Repair expected",
  CHECK_REQUESTED: "Please inspect",
  CHECK_FAILED: "Problem found",
  WORK_ORDER_ASSIGNED: "New job for you",
};

/** Every notification query of one user; mutations invalidate this prefix. */
export function notificationsQueryKey(userId: string | undefined) {
  return [userId, "notifications"] as const;
}

export function unreadNotificationCountQueryKey(userId: string | undefined) {
  return [...notificationsQueryKey(userId), "unread-count"] as const;
}

function notificationPageQueryKey(userId: string | undefined, page: number) {
  return [...notificationsQueryKey(userId), "page", page] as const;
}

/** The header's unread count; refreshed every minute and on window focus. */
export function useUnreadNotificationCount(enabled: boolean) {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery({
    queryKey: unreadNotificationCountQueryKey(userId),
    enabled: ready && enabled,
    retry: false,
    refetchInterval: COUNT_REFRESH_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/notifications/unread-count"
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useNotifications(page: number, enabled = true) {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery({
    queryKey: notificationPageQueryKey(userId, page),
    enabled: ready && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/notifications", {
        params: { query: { page, size: NOTIFICATION_PAGE_SIZE } },
      });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/** The same list as `useNotifications`, page after page, for phone widths. */
export function useNotificationFeed(enabled: boolean) {
  const { userId, ready } = useAuthenticatedSession();
  return useInfiniteQuery({
    queryKey: [...notificationsQueryKey(userId), "feed"],
    enabled: ready && enabled,
    retry: false,
    initialPageParam: 0,
    queryFn: async ({
      pageParam,
    }): Promise<components["schemas"]["NotificationPageResponse"]> => {
      const { data, error, response } = await api.GET("/notifications", {
        params: { query: { page: pageParam, size: NOTIFICATION_PAGE_SIZE } },
      });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    getNextPageParam: (page) =>
      (page.page + 1) * page.size < page.total ? page.page + 1 : undefined,
  });
}

export function useMarkNotificationRead() {
  const { userId } = useAuthenticatedSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error, response } = await api.POST(
        "/notifications/{notificationId}/read",
        { params: { path: { notificationId } } }
      );
      if (error) {
        throw estateError(error, response.status);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notificationsQueryKey(userId),
      }),
  });
}

export function useMarkAllNotificationsRead() {
  const { userId } = useAuthenticatedSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await api.POST(
        "/notifications/read-all"
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notificationsQueryKey(userId),
      }),
  });
}

export function notificationSettingsQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "notification-settings", estateId] as const;
}

export function useNotificationSettings(estateId: string) {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery({
    queryKey: notificationSettingsQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/notification-settings",
        { params: { path: { estateId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

export function useSaveNotificationSettings(estateId: string) {
  const { userId } = useAuthenticatedSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      const { data, error, response } = await api.PUT(
        "/estates/{estateId}/notification-settings",
        { params: { path: { estateId } }, body: settings }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notificationSettingsQueryKey(userId, estateId),
      }),
  });
}

export function assetAnomalyAlertsQueryKey(
  userId: string | undefined,
  estateId: string,
  assetId: string
) {
  return ["estates", userId, "anomaly-alerts", estateId, assetId] as const;
}

export function useAssetAnomalyAlerts(estateId: string, assetId: string) {
  const { userId, ready } = useAuthenticatedSession();
  return useQuery({
    queryKey: assetAnomalyAlertsQueryKey(userId, estateId, assetId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/assets/{assetId}/anomaly-alerts",
        { params: { path: { estateId, assetId } } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/** After a response: the inbox and every asset's alert history may show it. */
function useAlertResponseRefresh() {
  const { userId } = useAuthenticatedSession();
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationsQueryKey(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["estates", userId, "anomaly-alerts"],
        }),
      ]),
    [queryClient, userId]
  );
}

export function useAcknowledgeAlert() {
  const refresh = useAlertResponseRefresh();
  return useMutation({
    mutationFn: async ({
      notificationId,
      reason,
    }: {
      notificationId: string;
      reason?: string;
    }) => {
      const { data, error, response } = await api.POST(
        "/notifications/{notificationId}/acknowledge",
        {
          params: { path: { notificationId } },
          body: reason === undefined ? {} : { reason },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: refresh,
  });
}

export function useDismissAlert() {
  const refresh = useAlertResponseRefresh();
  return useMutation({
    mutationFn: async ({
      notificationId,
      reason,
    }: {
      notificationId: string;
      reason: string;
    }) => {
      const { data, error, response } = await api.POST(
        "/notifications/{notificationId}/dismiss",
        { params: { path: { notificationId } }, body: { reason } }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: refresh,
  });
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** "just now", "5 minutes ago", "yesterday", "3 months ago". */
export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const elapsed = Math.abs(seconds);
  if (elapsed < MINUTE) {
    return "just now";
  }
  if (elapsed < HOUR) {
    return RELATIVE.format(Math.trunc(seconds / MINUTE), "minute");
  }
  if (elapsed < DAY) {
    return RELATIVE.format(Math.trunc(seconds / HOUR), "hour");
  }
  if (elapsed < MONTH) {
    return RELATIVE.format(Math.trunc(seconds / DAY), "day");
  }
  if (elapsed < YEAR) {
    return RELATIVE.format(Math.trunc(seconds / MONTH), "month");
  }
  return RELATIVE.format(Math.trunc(seconds / YEAR), "year");
}
