import { fireEvent } from "@testing-library/react";
import { ownerEstateAccess, workspaceAccess } from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { NotificationSettingsPage } from "@/routes/_auth/estates/$estateId/notification-settings/-components/notification-settings-page/notification-settings-page";

const state = vi.hoisted(() => ({
  settings: undefined as unknown,
  error: null as Error | null,
  deactivatedAt: null as string | null,
  save: vi.fn(),
  canManageEstate: true,
}));

beforeEach(() => {
  state.settings = {
    anomalyEnabled: true,
    serviceDueEnabled: true,
    repairPredictedEnabled: false,
    checkRequestedEnabled: true,
    checkFailedEnabled: true,
    workOrderAssignedEnabled: true,
  };
  state.error = null;
  state.deactivatedAt = null;
  state.save = vi.fn(() => Promise.resolve(state.settings));
  state.canManageEstate = true;
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    data: {
      ...workspaceAccess,
      estates: [
        {
          ...ownerEstateAccess,
          estateId: "e-1",
          canManageEstate: state.canManageEstate,
        },
      ],
    },
  }),
}));

vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  useNotificationSettings: () => ({
    data: state.settings,
    error: state.error,
    isPending: !(state.settings || state.error),
    refetch: vi.fn(),
  }),
  useSaveNotificationSettings: () => ({
    mutateAsync: state.save,
    isPending: false,
  }),
}));
vi.mock("@/lib/estates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estates")>()),
  useEstate: () => ({
    data: {
      id: "e-1",
      name: "Harbour View",
      deactivatedAt: state.deactivatedAt,
    },
  }),
}));

const SWITCHES = [
  [
    "Unusual readings",
    "Tell us when a sensor shows something out of the ordinary.",
  ],
  ["Service due", "Remind us 90, 60, 30 and 14 days before a service is due."],
  [
    "Expected repair",
    "Warn us when something is likely to need repair in the next 90, 60 or 30 days.",
  ],
  [
    "Check requested",
    "Tell a staff member when they are asked to check something.",
  ],
  ["Check failed", "Tell managers when a check finds a problem."],
  ["Work order assigned", "Tell a staff member when a job is given to them."],
] as const;

function toggle(name: string) {
  return screen.getByRole("switch", { name });
}

function isOn(name: string) {
  return toggle(name).getAttribute("aria-checked") === "true";
}

it("sits under Estate settings with Details and Notifications tabs", () => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  screen.getByRole("heading", { level: 1, name: "Estate settings" });
  const views = within(
    screen.getByRole("navigation", { name: "Settings views" })
  );
  expect(views.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Details",
    "Notifications",
  ]);
});

it("hides the Details tab from a Manager who cannot edit the estate", () => {
  state.canManageEstate = false;
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  const views = within(
    screen.getByRole("navigation", { name: "Settings views" })
  );
  expect(views.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Notifications",
  ]);
});

it("explains the switches in plain words", () => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  screen.getByText(
    "Choose which messages this estate's team gets. All are on to start with."
  );
  for (const [name, help] of SWITCHES) {
    toggle(name);
    screen.getByText(help);
  }
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
});

it("shows each switch as the estate saved it", () => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  expect(isOn("Unusual readings")).toBe(true);
  expect(isOn("Expected repair")).toBe(false);
});

it("saves the switches", async () => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  fireEvent.click(toggle("Unusual readings"));
  fireEvent.click(toggle("Expected repair"));
  fireEvent.click(toggle("Check failed"));
  fireEvent.click(toggle("Work order assigned"));
  expect(isOn("Unusual readings")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(state.save).toHaveBeenCalledWith({
      anomalyEnabled: false,
      serviceDueEnabled: true,
      repairPredictedEnabled: true,
      checkRequestedEnabled: true,
      checkFailedEnabled: false,
      workOrderAssignedEnabled: false,
    })
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "Settings saved."
  );
});

it("shows a refused save", async () => {
  state.save = vi.fn(() =>
    Promise.reject(new Error("Couldn't save the settings. Try again."))
  );
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Couldn't save the settings. Try again."
  );
});

it("locks the form on an inactive estate", () => {
  state.deactivatedAt = "2026-11-01T00:00:00Z";
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  screen.getByText(
    "This estate is inactive, so you can't change these settings."
  );
  expect(
    screen
      .getByRole("button", { name: "Save settings" })
      .hasAttribute("disabled")
  ).toBe(true);
  expect(toggle("Service due").hasAttribute("data-disabled")).toBe(true);
});

it("shows a load error", () => {
  state.settings = undefined;
  state.error = new Error("Estate not found.");
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  expect(screen.getByRole("alert").textContent).toContain("Estate not found.");
});
