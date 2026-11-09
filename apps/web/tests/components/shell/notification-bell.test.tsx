import {
  councilEstateAccess,
  crewEstateAccess,
  ownerEstateAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/shell/notification-bell";

const ANY_NOTIFICATIONS = /Notifications/u;

const state = vi.hoisted(() => ({
  estates: [] as unknown[],
  unread: 0,
  accessLoads: 0,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
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
      }
      return Promise.resolve({
        data:
          path === "/access/context"
            ? { ...workspaceAccess, estates: state.estates }
            : { unread: state.unread },
        response: new Response(),
      });
    },
  },
}));

beforeEach(() => {
  state.estates = [ownerEstateAccess];
  state.unread = 0;
  state.accessLoads = 0;
});

it("links managers to their notifications", async () => {
  renderWithProviders(<NotificationBell />);
  const bell = await screen.findByRole<HTMLAnchorElement>("link", {
    name: "Notifications",
  });
  expect(bell.getAttribute("href")).toBe("/notifications");
});

it("names and shows the unread count", async () => {
  state.unread = 3;
  renderWithProviders(<NotificationBell />);
  const bell = await screen.findByRole("link", {
    name: "Notifications, 3 unread",
  });
  expect(bell.textContent).toContain("3");
});

it("caps the badge at 99+", async () => {
  state.unread = 120;
  renderWithProviders(<NotificationBell />);
  const bell = await screen.findByRole("link", {
    name: "Notifications, 120 unread",
  });
  expect(bell.textContent).toContain("99+");
});

it("is hidden from users who manage no estate", async () => {
  state.estates = [councilEstateAccess];
  renderWithProviders(<NotificationBell />);
  await waitFor(() => expect(state.accessLoads).toBe(1));
  expect(screen.queryByRole("link", { name: ANY_NOTIFICATIONS })).toBeNull();
});

it("shows crew their notifications, since they can be sent to inspect", async () => {
  state.estates = [crewEstateAccess];
  renderWithProviders(<NotificationBell />);
  await screen.findByRole("link", { name: "Notifications" });
});
