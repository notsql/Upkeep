import { fireEvent } from "@testing-library/react";
import { anomalyAlert } from "@tests/fixtures/notifications";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AlertResponseActions } from "@/components/notifications/alert-response-actions";

const state = vi.hoisted(() => ({
  acknowledge: vi.fn(),
  dismiss: vi.fn(),
}));

beforeEach(() => {
  state.acknowledge = vi.fn(() => Promise.resolve());
  state.dismiss = vi.fn(() => Promise.resolve());
});

vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  useAcknowledgeAlert: () => ({
    mutateAsync: state.acknowledge,
    isPending: false,
  }),
  useDismissAlert: () => ({ mutateAsync: state.dismiss, isPending: false }),
}));

function dialog() {
  return within(screen.getByRole("dialog", { name: "Dismiss alert" }));
}

it("acknowledges an alert", async () => {
  renderWithProviders(<AlertResponseActions alert={anomalyAlert} />);
  fireEvent.click(screen.getByRole("button", { name: "Mark as seen" }));
  await waitFor(() =>
    expect(state.acknowledge).toHaveBeenCalledWith({ notificationId: "n-1" })
  );
});

it("dismisses with a trimmed reason", async () => {
  renderWithProviders(<AlertResponseActions alert={anomalyAlert} />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  fireEvent.change(dialog().getByRole("textbox", { name: "Reason" }), {
    target: { value: "  Sensor recalibration  " },
  });
  fireEvent.click(dialog().getByRole("button", { name: "Dismiss alert" }));
  await waitFor(() =>
    expect(state.dismiss).toHaveBeenCalledWith({
      notificationId: "n-1",
      reason: "Sensor recalibration",
    })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("requires a reason to dismiss", () => {
  renderWithProviders(<AlertResponseActions alert={anomalyAlert} />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  fireEvent.change(dialog().getByRole("textbox", { name: "Reason" }), {
    target: { value: "   " },
  });
  fireEvent.click(dialog().getByRole("button", { name: "Dismiss alert" }));
  dialog().getByText("Enter a reason for dismissing this alert.");
  expect(
    dialog()
      .getByRole("textbox", { name: "Reason" })
      .getAttribute("aria-invalid")
  ).toBe("true");
  expect(state.dismiss).not.toHaveBeenCalled();
});

it("shows a refused dismissal in the dialog", async () => {
  state.dismiss = vi.fn(() =>
    Promise.reject(new Error("This alert has already been dismissed."))
  );
  renderWithProviders(<AlertResponseActions alert={anomalyAlert} />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  fireEvent.change(dialog().getByRole("textbox", { name: "Reason" }), {
    target: { value: "False alarm" },
  });
  fireEvent.click(dialog().getByRole("button", { name: "Dismiss alert" }));
  expect((await dialog().findByRole("alert")).textContent).toContain(
    "This alert has already been dismissed."
  );
});

it("only offers Dismiss once acknowledged", () => {
  renderWithProviders(
    <AlertResponseActions
      alert={{
        ...anomalyAlert,
        anomaly: { ...anomalyAlert.anomaly, response: "ACKNOWLEDGED" },
      }}
    />
  );
  expect(screen.queryByRole("button", { name: "Mark as seen" })).toBeNull();
  screen.getByRole("button", { name: "Dismiss" });
});

it("offers nothing once dismissed", () => {
  renderWithProviders(
    <AlertResponseActions
      alert={{
        ...anomalyAlert,
        anomaly: { ...anomalyAlert.anomaly, response: "DISMISSED" },
      }}
    />
  );
  expect(screen.queryByRole("button")).toBeNull();
});

it("disables the actions with the reason when locked", () => {
  renderWithProviders(
    <AlertResponseActions
      alert={anomalyAlert}
      locked="This asset is out of use, so you can't change its alerts."
    />
  );
  screen.getByText("This asset is out of use, so you can't change its alerts.");
  for (const name of ["Mark as seen", "Dismiss"]) {
    expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(
      true
    );
  }
});
