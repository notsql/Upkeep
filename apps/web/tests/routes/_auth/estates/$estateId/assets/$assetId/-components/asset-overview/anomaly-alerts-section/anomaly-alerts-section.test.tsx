import { anomalyAlert } from "@tests/fixtures/notifications";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AnomalyAlertsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/anomaly-alerts-section/anomaly-alerts-section";

const DISMISSED_BY = /Dismissed by Casey Doe/u;

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: null as Error | null,
}));

beforeEach(() => {
  state.data = [
    anomalyAlert,
    {
      ...anomalyAlert,
      id: "n-0",
      summary: "Abnormal readings: faulty",
      resolvedAt: "2026-11-01T00:00:00Z",
      anomaly: {
        ...anomalyAlert.anomaly,
        condition: "FAULTY",
        response: "DISMISSED",
        respondedByName: "Casey Doe",
        respondedAt: "2026-11-01T01:00:00Z",
        responseReason: "Sensor recalibration",
      },
    },
  ];
  state.error = null;
});

vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications")>()),
  useAssetAnomalyAlerts: () => ({
    data: state.data,
    error: state.error,
    isPending: !(state.data || state.error),
    refetch: vi.fn(),
  }),
  useAcknowledgeAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDismissAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function section() {
  return within(screen.getByRole("region", { name: "Anomaly alerts" }));
}

it("lists the asset's alerts with their outcome", () => {
  renderWithProviders(<AnomalyAlertsSection assetId="a-1" estateId="e-1" />);
  const items = section().getAllByRole("listitem");
  expect(items).toHaveLength(2);
  const open = within(items[0]);
  open.getByText("Open");
  open.getByText("Needs attention");
  open.getByText("Median score 0.74 · maximum 0.91");
  open.getByText("10 consecutive abnormal readings.");
  open.getByText("Not yet acknowledged");
  open.getByRole("button", { name: "Acknowledge" });
  const past = within(items[1]);
  past.getByText("Resolved");
  past.getByText("Faulty");
  expect(past.getByText(DISMISSED_BY).textContent).toContain(
    "Sensor recalibration"
  );
  expect(past.queryByRole("button")).toBeNull();
});

it("disables the actions with the lock reason", () => {
  renderWithProviders(
    <AnomalyAlertsSection
      assetId="a-1"
      estateId="e-1"
      locked="This asset is retired, so its alerts cannot be changed."
    />
  );
  expect(
    section()
      .getByRole("button", { name: "Acknowledge" })
      .hasAttribute("disabled")
  ).toBe(true);
});

it("says when there are no alerts", () => {
  state.data = [];
  renderWithProviders(<AnomalyAlertsSection assetId="a-1" estateId="e-1" />);
  section().getByText("No anomaly alerts for this asset.");
});

it("shows a load error", () => {
  state.data = undefined;
  state.error = new Error("Asset not found.");
  renderWithProviders(<AnomalyAlertsSection assetId="a-1" estateId="e-1" />);
  expect(section().getByRole("alert").textContent).toContain(
    "Asset not found."
  );
});
