import { fireEvent } from "@testing-library/react";
import {
  councilEstateAccess,
  crewEstateAccess,
  ownerEstateAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/shell/notification-bell";
import type { Notification } from "@/lib/notifications";

const ANY_NOTIFICATIONS = /Notifications/u;

const state = vi.hoisted(() => ({
  estates: [] as unknown[],
  unread: 0,
  accessLoads: 0,
  listLoads: 0,
  items: [] as unknown[],
  posts: [] as string[],
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    search: _search,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: unknown;
    search?: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: (path: string) => {
      if (path === "/access/context") {
        state.accessLoads += 1;
        return Promise.resolve({
          data: { ...workspaceAccess, estates: state.estates },
          response: new Response(),
        });
      }
      if (path === "/notifications") {
        state.listLoads += 1;
        return Promise.resolve({
          data: {
            items: state.items,
            page: 0,
            size: 20,
            total: state.items.length,
          },
          response: new Response(),
        });
      }
      return Promise.resolve({
        data: { unread: state.unread },
        response: new Response(),
      });
    },
    POST: (
      path: string,
      init: { params: { path: { notificationId: string } } }
    ) => {
      state.posts.push(`${path} ${init.params.path.notificationId}`);
      return Promise.resolve({ response: new Response(null, { status: 204 }) });
    },
  },
}));

const NOW = new Date().toISOString();

function notification(n: number, read = true): Notification {
  return {
    id: `n-${n}`,
    type: "SERVICE_DUE",
    estateId: "e-1",
    estateName: "Harbour View",
    assetId: "a-1",
    assetReference: "P-1",
    assetName: "Booster pump",
    summary: `Service due ${n}`,
    createdAt: NOW,
    updatedAt: NOW,
    resolvedAt: null,
    read,
    anomaly: null,
    serviceDue: null,
    repairPredicted: null,
    inspectionResultId: null,
    milestoneDays: null,
    workOrderId: null,
    workOrderReference: null,
  };
}

beforeEach(() => {
  state.estates = [ownerEstateAccess];
  state.unread = 0;
  state.accessLoads = 0;
  state.listLoads = 0;
  state.items = [];
  state.posts = [];
});

it("opens a dropdown from the bell instead of leaving the page", async () => {
  renderWithProviders(<NotificationBell />);
  const bell = await screen.findByRole("button", { name: "Notifications" });
  expect(screen.queryByRole("link", { name: ANY_NOTIFICATIONS })).toBeNull();
  // The list is only fetched once someone opens the dropdown.
  expect(state.listLoads).toBe(0);
  fireEvent.click(bell);
  await screen.findByRole("dialog", { name: "Notifications" });
  expect(state.listLoads).toBe(1);
});

it("shows the five most recent notifications and a link to all of them", async () => {
  state.items = [1, 2, 3, 4, 5, 6, 7].map((n) => notification(n));
  renderWithProviders(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications" }));
  const recent = await screen.findByRole("list", {
    name: "Recent notifications",
  });
  const rows = within(recent).getAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual(
    [1, 2, 3, 4, 5].map((n) => expect.stringContaining(`Service due ${n}`))
  );
  within(rows[0] as HTMLElement).getByText("Service due");
  within(rows[0] as HTMLElement).getByText("just now");
  const all = screen.getByRole<HTMLAnchorElement>("link", {
    name: "View all notifications",
  });
  expect(all.getAttribute("href")).toBe("/notifications");
});

it("marks an unread notification read and closes the dropdown when it is opened", async () => {
  state.unread = 1;
  state.items = [notification(1, false)];
  renderWithProviders(<NotificationBell />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Notifications, 1 unread" })
  );
  const recent = await screen.findByRole("list", {
    name: "Recent notifications",
  });
  within(recent).getByText("Unread");
  fireEvent.click(within(recent).getByRole("link"));
  await waitFor(() =>
    expect(state.posts).toEqual(["/notifications/{notificationId}/read n-1"])
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull()
  );
});

it("says when there are no notifications yet", async () => {
  renderWithProviders(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications" }));
  await screen.findByText("No notifications yet");
  screen.getByRole("link", { name: "View all notifications" });
});

it("names and shows the unread count", async () => {
  state.unread = 3;
  renderWithProviders(<NotificationBell />);
  const bell = await screen.findByRole("button", {
    name: "Notifications, 3 unread",
  });
  expect(bell.textContent).toContain("3");
});

it("caps the badge at 99+", async () => {
  state.unread = 120;
  renderWithProviders(<NotificationBell />);
  const bell = await screen.findByRole("button", {
    name: "Notifications, 120 unread",
  });
  expect(bell.textContent).toContain("99+");
});

it("is hidden from users who manage no estate", async () => {
  state.estates = [councilEstateAccess];
  renderWithProviders(<NotificationBell />);
  await waitFor(() => expect(state.accessLoads).toBe(1));
  expect(screen.queryByRole("button", { name: ANY_NOTIFICATIONS })).toBeNull();
});

it("shows crew their notifications, since they can be sent to inspect", async () => {
  state.estates = [crewEstateAccess];
  renderWithProviders(<NotificationBell />);
  await screen.findByRole("button", { name: "Notifications" });
});
