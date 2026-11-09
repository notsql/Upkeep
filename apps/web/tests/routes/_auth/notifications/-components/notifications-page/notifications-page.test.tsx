import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { NotificationsPage } from "@/routes/_auth/notifications/-components/notifications-page/notifications-page";

const SEND_STEP = /Please inspect Booster pump/u;
const PLEASE_INSPECT = /Send step/u;

const ANOMALY_LINK = /Booster pump may have a problem/u;
const UNUSUAL_SINCE = /^Its readings have been unusual since .+\.$/u;
const SERVICE_LINK = /Service due on 20 Nov 2026/u;
const NOW = new Date().toISOString();

const base = {
  estateId: "e-1",
  estateName: "Harbour View",
  assetId: "a-1",
  assetReference: "P-1",
  assetName: "Booster pump",
  createdAt: NOW,
  updatedAt: NOW,
  resolvedAt: null,
  anomaly: null,
  serviceDue: null,
  repairPredicted: null,
  inspectionResultId: null,
};
const anomaly = {
  ...base,
  id: "n-1",
  type: "ANOMALY",
  summary: "Abnormal readings: needs attention",
  read: false,
  anomaly: {
    condition: "NEEDS_ATTENTION",
    medianScore: 0.74,
    maxScore: 0.91,
    firstDetectedAt: NOW,
    lastDetectedAt: NOW,
    explanation: "10 consecutive abnormal readings.",
    response: "NONE",
    respondedByName: null,
    respondedAt: null,
    responseReason: null,
  },
};
const serviceDue = {
  ...base,
  id: "n-2",
  type: "SERVICE_DUE",
  assetId: "a-2",
  assetReference: "L-9",
  assetName: "Stair lights",
  summary: "Service due on 20 Nov 2026",
  read: true,
  serviceDue: {
    dueOn: "2026-11-20",
    interval: { value: 6, unit: "MONTH" },
    intervalSource: "CATEGORY",
  },
};

const state = vi.hoisted(() => ({
  page: 0,
  data: undefined as unknown,
  unread: 1,
  read: vi.fn(),
  readAll: vi.fn(),
}));

beforeEach(() => {
  state.page = 0;
  state.data = { items: [anomaly, serviceDue], page: 0, size: 20, total: 2 };
  state.unread = 1;
  state.read = vi.fn();
  state.readAll = vi.fn();
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string; assetId: string };
  }) => (
    <a
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock(
  "@/routes/_auth/notifications/-components/notifications-page/notification-dispatch",
  () => ({
    NotificationDispatch: ({
      notification,
    }: {
      notification: { type: string };
    }) => <span>{`Send step for ${notification.type}`}</span>,
  })
);
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  useNotifications: (page: number) => {
    state.page = page;
    return { data: state.data, error: null, isPending: !state.data };
  },
  useUnreadNotificationCount: () => ({ data: { unread: state.unread } }),
  useMarkNotificationRead: () => ({ mutate: state.read }),
  useAcknowledgeAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDismissAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkAllNotificationsRead: () => ({
    mutate: state.readAll,
    isPending: false,
    error: null,
  }),
}));

function list() {
  return within(screen.getByRole("list", { name: "Notifications" }));
}

it("lists notifications newest first with type, asset, estate and summary", () => {
  renderWithProviders(<NotificationsPage />);
  const items = list().getAllByRole("listitem");
  expect(items).toHaveLength(2);
  const first = within(items[0]);
  first.getByText("Unusual readings");
  first.getByText("Booster pump may have a problem");
  first.getByText(UNUSUAL_SINCE);
  first.getByText(
    "Have someone look at it. Mark as seen once it's being handled. Dismiss it if this was expected, for example during maintenance."
  );
  first.getByText("Booster pump (P-1)");
  first.getByText("Harbour View");
  first.getByText("just now");
  first.getByText("Unread");
  const second = within(items[1]);
  second.getByText("Service due");
  expect(second.queryByText("Unread")).toBeNull();
});

it("opens the asset and marks the notification read", () => {
  renderWithProviders(<NotificationsPage />);
  const link = list().getByRole<HTMLAnchorElement>("link", {
    name: ANOMALY_LINK,
  });
  expect(link.getAttribute("href")).toBe("/estates/e-1/assets/a-1");
  fireEvent.click(link);
  expect(state.read).toHaveBeenCalledWith("n-1");
});

it("does not mark an already-read notification again", () => {
  renderWithProviders(<NotificationsPage />);
  fireEvent.click(list().getByRole("link", { name: SERVICE_LINK }));
  expect(state.read).not.toHaveBeenCalled();
});

it("marks all as read", () => {
  renderWithProviders(<NotificationsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
  expect(state.readAll).toHaveBeenCalled();
});

it("disables mark all as read with nothing unread", () => {
  state.unread = 0;
  renderWithProviders(<NotificationsPage />);
  expect(
    screen
      .getByRole("button", { name: "Mark all as read" })
      .hasAttribute("disabled")
  ).toBe(true);
});

it("shows an empty inbox", () => {
  state.data = { items: [], page: 0, size: 20, total: 0 };
  state.unread = 0;
  renderWithProviders(<NotificationsPage />);
  screen.getByText("No notifications yet");
});

it("pages through older notifications", () => {
  state.data = { items: [anomaly], page: 0, size: 20, total: 45 };
  renderWithProviders(<NotificationsPage />);
  const paging = within(
    screen.getByRole("navigation", { name: "Notification pages" })
  );
  paging.getByText("Page 1 of 3");
  expect(
    paging
      .getByRole("button", { name: "Previous page" })
      .hasAttribute("disabled")
  ).toBe(true);
  fireEvent.click(paging.getByRole("button", { name: "Next page" }));
  expect(state.page).toBe(1);
});

it("offers acknowledge and dismiss on anomaly alerts only", () => {
  renderWithProviders(<NotificationsPage />);
  const [alertRow, dueRow] = list().getAllByRole("listitem");
  within(alertRow).getByRole("button", { name: "Mark as seen" });
  within(alertRow).getByRole("button", { name: "Dismiss" });
  expect(
    within(dueRow).queryByRole("button", { name: "Mark as seen" })
  ).toBeNull();
  expect(within(dueRow).queryByRole("button", { name: "Dismiss" })).toBeNull();
});

it("labels a service-due row as interval-based with its source", () => {
  renderWithProviders(<NotificationsPage />);
  const [, dueRow] = list().getAllByRole("listitem");
  within(dueRow).getByText(
    "Based on the service schedule · Every 6 months · Manufacturer interval for the category"
  );
});

it("says when the interval was set on the asset", () => {
  state.data = {
    items: [
      {
        ...serviceDue,
        serviceDue: {
          ...serviceDue.serviceDue,
          interval: { value: 90, unit: "DAY" },
          intervalSource: "ASSET",
        },
      },
    ],
    page: 0,
    size: 20,
    total: 1,
  };
  renderWithProviders(<NotificationsPage />);
  list().getByText(
    "Based on the service schedule · Every 90 days · Set on this asset"
  );
});

it.each([
  [
    "ASSET_HISTORY",
    3,
    "Expected repair · 42% chance within 30 days · based on 3 recorded repairs",
  ],
  [
    "ASSET_HISTORY",
    1,
    "Expected repair · 42% chance within 30 days · based on 1 recorded repair",
  ],
  [
    "SERVICE_INTERVAL",
    0,
    "Expected repair · 42% chance within 30 days · based on typical pumps; no repairs recorded yet",
  ],
])("explains a %s repair prediction", (basis, failuresObserved, text) => {
  state.data = {
    items: [
      {
        ...base,
        id: "n-3",
        type: "REPAIR_PREDICTED",
        summary: "Repair likely within 30 days (42% chance)",
        read: false,
        repairPredicted: {
          recommendedTimeframe: "WITHIN_30_DAYS",
          probability: 0.42,
          basis,
          failuresObserved,
        },
      },
    ],
    page: 0,
    size: 20,
    total: 1,
  };
  renderWithProviders(<NotificationsPage />);
  list().getByText(text);
});

const checkRequested = {
  ...base,
  id: "n-3",
  type: "CHECK_REQUESTED",
  summary: "Sent by Morgan Lee",
  read: false,
};
const checkFailed = {
  ...base,
  id: "n-4",
  type: "CHECK_FAILED",
  summary: "Motor is grinding loudly",
  read: false,
  inspectionResultId: "r-1",
};

it("asks the person sent to inspect, linking to the inspection form", () => {
  state.data = { items: [checkRequested], page: 0, size: 20, total: 1 };
  renderWithProviders(<NotificationsPage />);
  const link = list().getByRole("link", {
    name: SEND_STEP,
  });
  expect(link.getAttribute("href")).toBe(
    "/estates/e-1/assets/a-1/inspections/new"
  );
  list().getByText("Sent by Morgan Lee");
  expect(list().queryByText(PLEASE_INSPECT)).toBeNull();
});

it("tells managers crew found a problem, with the inspector's note and a send step", () => {
  state.data = { items: [checkFailed], page: 0, size: 20, total: 1 };
  renderWithProviders(<NotificationsPage />);
  list().getByText("Crew found a problem with Booster pump");
  list().getByText("Motor is grinding loudly");
  list().getByText("Send step for CHECK_FAILED");
});

it("offers the send step on service-due rows but not anomaly alerts", () => {
  renderWithProviders(<NotificationsPage />);
  const [alertRow, dueRow] = list().getAllByRole("listitem");
  within(dueRow).getByText("Send step for SERVICE_DUE");
  expect(within(alertRow).queryByText(PLEASE_INSPECT)).toBeNull();
});
