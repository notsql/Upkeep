import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { NotificationSettingsPage } from "@/routes/_auth/estates/$estateId/notification-settings/-components/notification-settings-page/notification-settings-page";

const state = vi.hoisted(() => ({
  settings: undefined as unknown,
  error: null as Error | null,
  deactivatedAt: null as string | null,
  save: vi.fn(),
}));

beforeEach(() => {
  state.settings = {
    anomalyScoreThreshold: 0.51,
    serviceLeadDays: 14,
    repairLeadDays: 30,
  };
  state.error = null;
  state.deactivatedAt = null;
  state.save = vi.fn(() => Promise.resolve(state.settings));
});

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

function field(name: string) {
  return screen.getByRole<HTMLInputElement>("spinbutton", { name });
}

it("shows the estate's current settings", () => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  expect(field("How sure before we warn you (%)").value).toBe("51");
  expect(field("Days of notice before a service is due").value).toBe("14");
  expect(
    screen.getByRole("combobox", { name: "Notice before an expected repair" })
      .textContent
  ).toContain("30 days");
});

it("saves changed settings", async () => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  fireEvent.change(field("How sure before we warn you (%)"), {
    target: { value: "80" },
  });
  fireEvent.change(field("Days of notice before a service is due"), {
    target: { value: "7" },
  });
  await chooseOption(
    screen.getByRole("combobox", { name: "Notice before an expected repair" }),
    "90 days"
  );
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(state.save).toHaveBeenCalledWith({
      anomalyScoreThreshold: 0.8,
      serviceLeadDays: 7,
      repairLeadDays: 90,
    })
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "Settings saved."
  );
});

it.each([
  [
    "How sure before we warn you (%)",
    "50",
    "Enter a whole number from 51 to 100.",
  ],
  [
    "How sure before we warn you (%)",
    "55.5",
    "Enter a whole number from 51 to 100.",
  ],
  [
    "Days of notice before a service is due",
    "400",
    "Enter a whole number of days from 0 to 365.",
  ],
  [
    "Days of notice before a service is due",
    "1.5",
    "Enter a whole number of days from 0 to 365.",
  ],
])("refuses %s of %s", (name, value, message) => {
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  fireEvent.change(field(name), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  screen.getByText(message);
  expect(field(name).getAttribute("aria-invalid")).toBe("true");
  expect(state.save).not.toHaveBeenCalled();
});

it("shows a refused save", async () => {
  state.save = vi.fn(() =>
    Promise.reject(new Error("repairLeadDays: must be 30, 60 or 90."))
  );
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "repairLeadDays: must be 30, 60 or 90."
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
});

it("shows a load error", () => {
  state.settings = undefined;
  state.error = new Error("Estate not found.");
  renderWithProviders(<NotificationSettingsPage estateId="e-1" />);
  expect(screen.getByRole("alert").textContent).toContain("Estate not found.");
});
