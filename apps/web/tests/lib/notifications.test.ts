import { createElement, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  assetAnomalyAlertsQueryKey,
  formatRelativeTime,
  notificationSettingsQueryKey,
  notificationsQueryKey,
  unreadNotificationCountQueryKey,
  useAcknowledgeAlert,
  useAssetAnomalyAlerts,
  useDismissAlert,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationSettings,
  useNotifications,
  useSaveNotificationSettings,
  useUnreadNotificationCount,
} from "@/lib/notifications";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

function Count() {
  const count = useUnreadNotificationCount(true);
  return count.data === undefined
    ? null
    : createElement("output", null, String(count.data.unread));
}

function List() {
  const list = useNotifications(2);
  return list.data
    ? createElement("output", null, String(list.data.total))
    : null;
}

function Read() {
  const { mutate } = useMarkNotificationRead();
  useEffect(() => {
    mutate("n-1");
  }, [mutate]);
  return null;
}

function ReadAll() {
  const read = useMarkAllNotificationsRead();
  const { mutate } = read;
  useEffect(() => {
    mutate();
  }, [mutate]);
  return read.error ? createElement("output", null, read.error.message) : null;
}

function Settings() {
  const settings = useNotificationSettings("e-1");
  return settings.data
    ? createElement(
        "output",
        null,
        settings.data.serviceDueEnabled ? "on" : "off"
      )
    : null;
}

const SAVED = {
  anomalyEnabled: true,
  serviceDueEnabled: true,
  repairPredictedEnabled: false,
  checkRequestedEnabled: true,
  checkFailedEnabled: true,
  workOrderAssignedEnabled: true,
} as const;

function SaveSettings() {
  const { mutate } = useSaveNotificationSettings("e-1");
  useEffect(() => {
    mutate(SAVED);
  }, [mutate]);
  return null;
}

describe("notification hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the unread count under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { unread: 4 },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Count));
    await screen.findByText("4");
    expect(api.GET).toHaveBeenCalledWith("/notifications/unread-count");
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: unreadNotificationCountQueryKey("manager") })
    ).toBeDefined();
  });

  it("loads a page of notifications", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { items: [], page: 2, size: 20, total: 41 },
      response: new Response(),
    } as never);
    renderWithProviders(createElement(List));
    await screen.findByText("41");
    expect(api.GET).toHaveBeenCalledWith("/notifications", {
      params: { query: { page: 2, size: 20 } },
    });
  });

  it("marks one read and refreshes the user's notifications", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      response: new Response(null, { status: 204 }),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Read));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        "/notifications/{notificationId}/read",
        { params: { path: { notificationId: "n-1" } } }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: notificationsQueryKey("manager"),
      })
    );
  });

  it("marks all read and refreshes the user's notifications", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: { unread: 0 },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(ReadAll));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/notifications/read-all")
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: notificationsQueryKey("manager"),
      })
    );
  });

  it("turns a failed mark-all into an error", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: { message: "Sign in to see notifications." },
      response: new Response(null, { status: 500 }),
    } as never);
    renderWithProviders(createElement(ReadAll));
    await screen.findByText("Sign in to see notifications.");
  });
});

describe("notification settings hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads an estate's settings under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...SAVED, serviceDueEnabled: false },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Settings));
    await screen.findByText("off");
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/notification-settings",
      { params: { path: { estateId: "e-1" } } }
    );
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: notificationSettingsQueryKey("manager", "e-1") })
    ).toBeDefined();
  });

  it("saves settings and refreshes them", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      data: SAVED,
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(SaveSettings));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        "/estates/{estateId}/notification-settings",
        { params: { path: { estateId: "e-1" } }, body: SAVED }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: notificationSettingsQueryKey("manager", "e-1"),
      })
    );
  });
});

function AssetAlerts() {
  const alerts = useAssetAnomalyAlerts("e-1", "a-1");
  return alerts.data
    ? createElement("output", null, String(alerts.data.length))
    : null;
}

function Acknowledge() {
  const { mutate } = useAcknowledgeAlert();
  useEffect(() => {
    mutate({ notificationId: "n-1" });
  }, [mutate]);
  return null;
}

function Dismiss() {
  const { mutate } = useDismissAlert();
  useEffect(() => {
    mutate({ notificationId: "n-1", reason: "False alarm" });
  }, [mutate]);
  return null;
}

describe("anomaly alert hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads an asset's alerts", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [{ id: "n-1" }, { id: "n-2" }],
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(AssetAlerts));
    await screen.findByText("2");
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/anomaly-alerts",
      { params: { path: { estateId: "e-1", assetId: "a-1" } } }
    );
    expect(
      queryClient.getQueryCache().find({
        queryKey: assetAnomalyAlertsQueryKey("manager", "e-1", "a-1"),
      })
    ).toBeDefined();
  });

  it.each([
    [
      "acknowledges",
      Acknowledge,
      "/notifications/{notificationId}/acknowledge",
      {},
    ],
    [
      "dismisses",
      Dismiss,
      "/notifications/{notificationId}/dismiss",
      { reason: "False alarm" },
    ],
  ])(
    "%s and refreshes notifications and asset alerts",
    async (_, component, path, body) => {
      vi.mocked(api.POST).mockResolvedValue({
        data: { id: "n-1" },
        response: new Response(),
      } as never);
      const { queryClient } = renderWithProviders(createElement(component));
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      await waitFor(() =>
        expect(api.POST).toHaveBeenCalledWith(path, {
          params: { path: { notificationId: "n-1" } },
          body,
        })
      );
      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: notificationsQueryKey("manager"),
        })
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["estates", "manager", "anomaly-alerts"],
      });
    }
  );
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it.each([
    ["2026-11-08T11:59:30Z", "just now"],
    ["2026-11-08T11:55:00Z", "5 minutes ago"],
    ["2026-11-08T09:00:00Z", "3 hours ago"],
    ["2026-11-07T12:00:00Z", "yesterday"],
    ["2026-11-01T12:00:00Z", "7 days ago"],
  ])("formats %s as %s", (iso, text) => {
    expect(formatRelativeTime(iso, now)).toBe(text);
  });
});
