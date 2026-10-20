import { act, fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { MonitoredSensor, SensorPolicy } from "@/lib/flatlined-sensors";
import { SensorsPage } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
let userId = "owner";
let mobile = false;
vi.mock("@/lib/use-mobile", () => ({ useMobile: () => mobile }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: userId }, loading: false }),
}));

const POLICY_PATH = "/estates/{estateId}/flatline-policies";
const REVIEW_PATH = "/estates/{estateId}/flatlined-sensors";
const POLICY_ACTION = /^(Edit|Set up).*policy$/;
const sensor: MonitoredSensor = {
  deviceId: "device-id",
  assetId: "asset-id",
  deviceIdentifier: "PUMP-01",
  assetName: "Water pump",
  assetReference: "E-A0001",
  assetLocationPath: "Block A › L2 › Pump room",
  deviceLocationPath: "Block A › L2 › Pump room",
  metric: "TEMPERATURE",
  unit: "°C",
  state: "FLATLINED",
  lastReadingAt: "2026-10-20T04:00:00Z",
  lastValue: 21.5,
  thresholdMinutes: 2,
  tolerance: 0,
  pause: null,
  flatline: {
    unchangedSince: "2026-10-20T03:58:00Z",
    lastReadingAt: "2026-10-20T04:00:00Z",
    observedDurationSeconds: 120,
    minimumValue: 21.5,
    maximumValue: 21.5,
    latestValue: 21.5,
  },
};
const policy: SensorPolicy = {
  metric: "TEMPERATURE",
  unit: "°C",
  durationMinutes: 2,
  tolerance: 0,
};
let canManage: boolean;
let estateActive: boolean;
let reviewError: boolean;
let rows: MonitoredSensor[];
let total: number;
let policies: SensorPolicy[];

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === POLICY_PATH) {
      return Promise.resolve({
        data: { canManage, estateActive, policies },
        response: new Response(),
      });
    }
    if (reviewError) {
      return Promise.resolve({
        error: { message: "Device readings are temporarily unavailable." },
        response: new Response(null, { status: 503 }),
      });
    }
    return Promise.resolve({
      data: {
        checkedAt: "2026-10-20T04:00:00Z",
        canManage,
        estateActive,
        hasSensorReadings: true,
        page: 0,
        size: 25,
        totalElements: total,
        sensors: rows,
      },
      response: new Response(),
    });
  }) as never);
}

async function expandPolicies() {
  const toggle = await screen.findByRole("button", { name: "Metric policies" });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(toggle);
  }
}

describe("SensorsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    userId = "owner";
    mobile = false;
    canManage = true;
    estateActive = true;
    reviewError = false;
    rows = [sensor];
    total = 1;
    policies = [
      policy,
      {
        metric: "PRESSURE",
        unit: "bar",
        durationMinutes: null,
        tolerance: 0,
      },
    ];
    serve();
  });

  it("shows last observed flatline evidence and metric settings without claiming the asset is faulty", async () => {
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await screen.findByRole("heading", { name: "Device monitoring" });
    const table = within(
      await screen.findByRole("table", { name: "Device metrics" })
    );
    table.getByText("PUMP-01");
    table.getByText("Location: Block A › L2 › Pump room");
    table.getByText("Possible flatline");
    table.getByText("Unchanged for 120 seconds");
    screen.getByRole("table", { name: "Metric policies" });
    expect(
      screen.queryByRole("form", { name: "Temperature policy" })
    ).toBeNull();
    screen.getByRole("button", { name: "Edit temperature policy" });
    expect(screen.queryByText("FAULTY")).toBeNull();
  });

  it.each([false, true])(
    "distinguishes identical asset names by location and labels separate device locations (mobile=%s)",
    async (isMobile) => {
      mobile = isMobile;
      rows = [
        sensor,
        {
          ...sensor,
          deviceId: "other-device",
          deviceIdentifier: "PUMP-02",
          assetId: "other-asset",
          assetReference: "E-A0002",
          assetLocationPath: "Block B › L2 › Pump room",
          deviceLocationPath: "Block B › L2 › Corridor",
        },
      ];
      total = 2;
      renderWithProviders(<SensorsPage estateId="estate-id" />);
      await expandPolicies();
      const results = within(
        await screen.findByRole(isMobile ? "list" : "table", {
          name: "Device metrics",
        })
      );
      expect(results.getAllByText("Water pump")).toHaveLength(2);
      results.getByText("Location: Block A › L2 › Pump room");
      results.getByText("Asset location: Block B › L2 › Pump room");
      results.getByText("Device location: Block B › L2 › Corridor");
      expect(screen.queryByRole("link", { name: "Water pump" })).toBeNull();
    }
  );

  it("lets Council read settings and pauses without exposing edit controls or restricted asset links", async () => {
    canManage = false;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await screen.findByText("Possible flatline");
    expect(
      screen.queryByRole("button", { name: "Save temperature policy" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Pause PUMP-01 temperature" })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Water pump" })).toBeNull();
    expect(screen.queryByRole("button", { name: POLICY_ACTION })).toBeNull();
    screen.getByText(
      "Only estate owners and assigned managers can change metric policies."
    );
  });

  it("summarizes saved policies and opens only one editor at a time", async () => {
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    const summary = within(
      await screen.findByRole("table", { name: "Metric policies" })
    );
    screen.getByText("1 of 2 configured");
    summary.getByText("2 minutes · tolerance 0 °C");
    summary.getByText("Not set");
    expect(screen.queryByRole("form")).toBeNull();
    const edit = summary.getByRole("button", {
      name: "Edit temperature policy",
    });
    expect(edit.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(edit);
    screen.getByRole("form", { name: "Temperature policy" });
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Temperature policy" })
    );
    expect(edit.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(
      summary.getByRole("button", { name: "Set up pressure policy" })
    );
    expect(
      screen.queryByRole("form", { name: "Temperature policy" })
    ).toBeNull();
    const form = within(screen.getByRole("form", { name: "Pressure policy" }));
    expect(
      form.getByRole<HTMLInputElement>("spinbutton", { name: "Threshold" })
        .value
    ).toBe("");
    expect(
      form.getByRole<HTMLInputElement>("spinbutton", {
        name: "Tolerance (bar)",
      }).value
    ).toBe("0");
  });

  it.each([false, true])(
    "starts Metric policies collapsed with its count visible and expands on demand (mobile=%s)",
    async (isMobile) => {
      mobile = isMobile;
      renderWithProviders(<SensorsPage estateId="estate-id" />);
      const toggle = await screen.findByRole("button", {
        name: "Metric policies",
      });
      screen.getByRole("heading", { name: "Device monitoring" });
      screen.getByText("1 of 2 configured");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(
        screen.queryByRole(isMobile ? "list" : "table", {
          name: "Metric policies",
        })
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Edit temperature policy" })
      ).toBeNull();
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      screen.getByRole(isMobile ? "list" : "table", {
        name: "Metric policies",
      });
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(
        screen.queryByRole("button", { name: "Edit temperature policy" })
      ).toBeNull();
      screen.getByText("1 of 2 configured");
    }
  );

  it("preserves the inline editor draft when the policy section is collapsed and reopened", async () => {
    mobile = true;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit temperature policy" })
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Threshold" }), {
      target: { value: "10" },
    });
    const toggle = screen.getByRole("button", { name: "Metric policies" });
    fireEvent.click(toggle);
    expect(
      screen.queryByRole("form", { name: "Temperature policy" })
    ).toBeNull();
    fireEvent.click(toggle);
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "Threshold" })
        .value
    ).toBe("10");
    expect(api.PUT).not.toHaveBeenCalled();
    const entries = within(
      screen.getByRole("list", { name: "Metric policies" })
    ).getAllByRole("listitem");
    within(entries[0]).getByRole("form", { name: "Temperature policy" });
  });

  it("cancels a policy draft without saving and restores the saved values on reopening", async () => {
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    const edit = await screen.findByRole("button", {
      name: "Edit temperature policy",
    });
    fireEvent.click(edit);
    const form = within(
      screen.getByRole("form", { name: "Temperature policy" })
    );
    fireEvent.change(form.getByRole("spinbutton", { name: "Threshold" }), {
      target: { value: "10" },
    });
    fireEvent.click(form.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).toBeNull();
    expect(api.PUT).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(edit);
    fireEvent.click(edit);
    expect(
      within(
        screen.getByRole("form", { name: "Temperature policy" })
      ).getByRole<HTMLInputElement>("spinbutton", { name: "Threshold" }).value
    ).toBe("2");
  });

  it("opens Edit directly beneath its mobile metric and Set up inside the selected metric entry", async () => {
    mobile = true;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    const list = within(
      await screen.findByRole("list", { name: "Metric policies" })
    );
    const entries = list.getAllByRole("listitem");
    fireEvent.click(
      list.getByRole("button", { name: "Edit temperature policy" })
    );
    within(entries[0]).getByRole("form", { name: "Temperature policy" });
    expect(within(entries[1]).queryByRole("form")).toBeNull();
    fireEvent.click(
      list.getByRole("button", { name: "Set up pressure policy" })
    );
    within(entries[1]).getByRole("form", { name: "Pressure policy" });
    expect(within(entries[0]).queryByRole("form")).toBeNull();
  });

  it("inserts the desktop editor row immediately after the selected metric", async () => {
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    const table = within(
      await screen.findByRole("table", { name: "Metric policies" })
    );
    fireEvent.click(
      table.getByRole("button", { name: "Edit temperature policy" })
    );
    const policyRows = table.getAllByRole("row");
    within(policyRows[1]).getByText("Temperature");
    within(policyRows[2]).getByRole("form", { name: "Temperature policy" });
    within(policyRows[3]).getByText("Pressure");
    fireEvent.click(
      table.getByRole("button", { name: "Set up pressure policy" })
    );
    const updated = table.getAllByRole("row");
    within(updated[2]).getByText("Pressure");
    within(updated[3]).getByRole("form", { name: "Pressure policy" });
    expect(
      screen.queryByRole("form", { name: "Temperature policy" })
    ).toBeNull();
  });

  it("closes the editor after a successful save and shows the updated summary", async () => {
    vi.mocked(api.PUT).mockImplementation((() => {
      policies = [
        { ...policy, durationMinutes: 10, tolerance: 0.5 },
        policies[1],
      ];
      return Promise.resolve({ data: policies[0], response: new Response() });
    }) as never);
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit temperature policy" })
    );
    const form = within(
      screen.getByRole("form", { name: "Temperature policy" })
    );
    fireEvent.change(form.getByRole("spinbutton", { name: "Threshold" }), {
      target: { value: "10" },
    });
    fireEvent.change(form.getByRole("spinbutton", { name: "Tolerance (°C)" }), {
      target: { value: "0.5" },
    });
    fireEvent.click(
      form.getByRole("button", { name: "Save temperature policy" })
    );
    await screen.findByText("10 minutes · tolerance 0.5 °C");
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
  });

  it("prevents closing or switching the editor until the save completes", async () => {
    let finish: (() => void) | undefined;
    vi.mocked(api.PUT).mockImplementation(
      (() =>
        new Promise((resolve) => {
          finish = () => resolve({ data: policy, response: new Response() });
        })) as never
    );
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit temperature policy" })
    );
    const form = within(
      screen.getByRole("form", { name: "Temperature policy" })
    );
    fireEvent.click(
      form.getByRole("button", { name: "Save temperature policy" })
    );
    await waitFor(() => expect(api.PUT).toHaveBeenCalled());
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Metric policies" })
        .disabled
    ).toBe(true);
    expect(
      form.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Set up pressure policy",
      }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Close temperature policy",
      }).disabled
    ).toBe(true);
    await act(async () => finish?.());
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
  });

  it("keeps an open policy draft during background refresh and a change to mobile layout", async () => {
    const { rerender, queryClient } = renderWithProviders(
      <SensorsPage estateId="estate-id" />
    );
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit temperature policy" })
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Threshold" }), {
      target: { value: "10" },
    });
    policies = [{ ...policy, durationMinutes: 3 }, policies[1]];
    await act(async () =>
      queryClient.invalidateQueries({
        queryKey: ["owner", "flatline", "estate-id"],
      })
    );
    mobile = true;
    rerender(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    expect(
      screen.getByRole<HTMLInputElement>("spinbutton", { name: "Threshold" })
        .value
    ).toBe("10");
    screen.getByText("3 minutes · tolerance 0 °C");
    expect(screen.queryByRole("table", { name: "Metric policies" })).toBeNull();
  });

  it("shows one mobile sensor list with all evidence and maintenance actions", async () => {
    mobile = true;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    const list = within(
      await screen.findByRole("list", { name: "Device metrics" })
    );
    list.getByText("PUMP-01");
    list.getByText("Water pump");
    list.getByText("E-A0001");
    list.getByText("Temperature (°C)");
    list.getByText("Possible flatline");
    list.getByText("Unchanged for 120 seconds");
    list.getByText("Range 21.5–21.5 °C");
    list.getByText("21.5 °C");
    expect(screen.queryByRole("table", { name: "Device metrics" })).toBeNull();
    fireEvent.click(
      list.getByRole("button", { name: "Pause PUMP-01 temperature" })
    );
    await screen.findByRole("dialog", { name: "Pause PUMP-01 temperature" });
  });

  it("keeps mobile policies read-only for Council", async () => {
    mobile = true;
    canManage = false;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    const list = within(
      await screen.findByRole("list", { name: "Metric policies" })
    );
    list.getByText("2 minutes · tolerance 0 °C");
    expect(screen.queryByRole("button", { name: POLICY_ACTION })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Pause PUMP-01 temperature" })
    ).toBeNull();
  });

  it("converts whole hours to minutes and refreshes settings and review after saving", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      data: { ...policy, durationMinutes: 120, tolerance: 0.01 },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(
      <SensorsPage estateId="estate-id" />
    );
    await expandPolicies();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit temperature policy" })
    );
    const form = within(
      await screen.findByRole("form", { name: "Temperature policy" })
    );
    await chooseOption(
      form.getByRole("combobox", { name: "Time unit" }),
      "Hours"
    );
    fireEvent.change(form.getByRole("spinbutton", { name: "Threshold" }), {
      target: { value: "2" },
    });
    fireEvent.change(form.getByRole("spinbutton", { name: "Tolerance (°C)" }), {
      target: { value: "0.01" },
    });
    fireEvent.click(
      form.getByRole("button", { name: "Save temperature policy" })
    );
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        "/estates/{estateId}/flatline-policies/{metric}",
        {
          params: { path: { estateId: "estate-id", metric: "TEMPERATURE" } },
          body: { durationMinutes: 120, tolerance: 0.01 },
        }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["owner", "flatline", "estate-id"],
      })
    );
  });

  it("rejects fractional time and retains edited values when a save fails", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      error: { message: "Your estate role changed." },
      response: new Response(null, { status: 403 }),
    } as never);
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit temperature policy" })
    );
    const element = await screen.findByRole("form", {
      name: "Temperature policy",
    });
    const form = within(element);
    const threshold = form.getByRole<HTMLInputElement>("spinbutton", {
      name: "Threshold",
    });
    fireEvent.change(threshold, { target: { value: "1.5" } });
    fireEvent.submit(element);
    expect(api.PUT).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "whole-number"
    );
    fireEvent.change(threshold, { target: { value: "10" } });
    fireEvent.submit(element);
    await screen.findByText("Your estate role changed.");
    expect(threshold.value).toBe("10");
  });

  it("pauses only the selected sensor with a finite duration and refreshes the review", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: {
        deviceId: "device-id",
        metric: "TEMPERATURE",
        pausedAt: "2026-10-20T04:00:00Z",
        resumesAt: "2026-10-20T05:30:00Z",
        pausedByUserId: "owner",
      },
      response: new Response(null, { status: 201 }),
    } as never);
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Pause PUMP-01 temperature" })
    );
    const dialog = within(
      await screen.findByRole("dialog", { name: "Pause PUMP-01 temperature" })
    );
    fireEvent.change(
      dialog.getByRole("spinbutton", { name: "Pause duration" }),
      { target: { value: "90" } }
    );
    fireEvent.click(dialog.getByRole("button", { name: "Start pause" }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        "/estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric}",
        {
          params: {
            path: {
              estateId: "estate-id",
              deviceId: "device-id",
              metric: "TEMPERATURE",
            },
          },
          body: { durationMinutes: 90 },
        }
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows active pauses explicitly and does not offer to extend them", async () => {
    rows = [
      {
        ...sensor,
        state: "PAUSED",
        flatline: null,
        pause: {
          deviceId: "device-id",
          metric: "TEMPERATURE",
          pausedAt: "2026-10-20T04:00:00Z",
          resumesAt: "2026-10-20T05:00:00Z",
          pausedByUserId: "owner",
        },
      },
    ];
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await screen.findByText("Maintenance paused");
    expect(
      screen.queryByRole("button", { name: "Pause PUMP-01 temperature" })
    ).toBeNull();
    expect(screen.queryByText("Unchanged for 120 seconds")).toBeNull();
  });

  it("switches to all sensors for maintenance and sends the selected page", async () => {
    total = 26;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await chooseOption(
      await screen.findByRole("combobox", { name: "Device metric view" }),
      "All device metrics"
    );
    fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(api.GET).toHaveBeenCalledWith(
        REVIEW_PATH,
        expect.objectContaining({
          params: {
            path: { estateId: "estate-id" },
            query: { view: "ALL", page: 1, size: 25 },
          },
        })
      )
    );
  });

  it("reports review failures with retry instead of showing zero flatlines", async () => {
    reviewError = true;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await screen.findByText("Device readings are temporarily unavailable.");
    screen.getByRole("button", { name: "Retry device metrics" });
    expect(
      screen.queryByText("No device metrics currently need review.")
    ).toBeNull();
  });

  it("retains a policy draft during a failed review refresh and resumes editing after retry", async () => {
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit temperature policy" })
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Threshold" }), {
      target: { value: "10" },
    });
    reviewError = true;
    fireEvent.click(screen.getByRole("button", { name: "Refresh readings" }));
    await screen.findByText("Device readings are temporarily unavailable.");
    const threshold = screen.getByRole<HTMLInputElement>("spinbutton", {
      name: "Threshold",
    });
    expect(threshold.value).toBe("10");
    expect(threshold.disabled).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Save temperature policy" })
    ).toBeNull();
    reviewError = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Retry device metrics" })
    );
    await screen.findByRole("button", { name: "Save temperature policy" });
    expect(threshold.value).toBe("10");
    expect(threshold.disabled).toBe(false);
  });

  it("keeps inactive estates readable without edit or pause actions", async () => {
    estateActive = false;
    rows = [];
    total = 0;
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await screen.findByText(
      "This estate is inactive. Metric policies remain available to view."
    );
    expect(
      screen.queryByRole("button", { name: "Save temperature policy" })
    ).toBeNull();
  });

  it("uses a fresh account cache when the signed-in user changes", async () => {
    const { rerender, queryClient } = renderWithProviders(
      <SensorsPage estateId="estate-id" />
    );
    await expandPolicies();
    await screen.findByText("Possible flatline");
    userId = "council";
    canManage = false;
    rerender(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    await screen.findByText(
      "Only estate owners and assigned managers can change metric policies."
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryCache().findAll({ queryKey: ["owner", "flatline"] })
      ).toHaveLength(0)
    );
    expect(
      queryClient.getQueryCache().findAll({ queryKey: ["council", "flatline"] })
        .length
    ).toBeGreaterThan(0);
  });

  it("refreshes while visible and stops polling while the page is hidden", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const countReviews = () =>
      vi.mocked(api.GET).mock.calls.filter((call) => call[0] === REVIEW_PATH)
        .length;
    try {
      renderWithProviders(<SensorsPage estateId="estate-id" />);
      await expandPolicies();
      await screen.findByText("Possible flatline");
      const initial = countReviews();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await waitFor(() => expect(countReviews()).toBeGreaterThan(initial));
      visibility.mockReturnValue("hidden");
      fireEvent(window, new Event("visibilitychange"));
      const hidden = countReviews();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect(countReviews()).toBe(hidden);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retains the chosen pause duration when the server rejects the request", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: {
        message: "This device metric already has an active maintenance pause.",
      },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWithProviders(<SensorsPage estateId="estate-id" />);
    await expandPolicies();
    fireEvent.click(
      await screen.findByRole("button", { name: "Pause PUMP-01 temperature" })
    );
    const dialog = within(
      await screen.findByRole("dialog", { name: "Pause PUMP-01 temperature" })
    );
    const input = dialog.getByRole<HTMLInputElement>("spinbutton", {
      name: "Pause duration",
    });
    fireEvent.change(input, { target: { value: "90" } });
    fireEvent.click(dialog.getByRole("button", { name: "Start pause" }));
    await dialog.findByText(
      "This device metric already has an active maintenance pause."
    );
    expect(input.value).toBe("90");
  });
});
