import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetQueryKey } from "@/lib/assets";
import { ManualReadingForm } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form";

const { get, post, permission } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  permission: { canRecord: true },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "crew" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/access", () => ({
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate",
          estateName: "Maple Estate",
          canViewReadings: true,
          canRecordReadings: permission.canRecord,
        },
      ],
    },
  }),
}));
const ASSET = "b6d6fe0d-32c5-4c77-a034-81aac211dfaa";
const METRICS = [
  { metric: "TEMPERATURE", unit: "°C", validMin: -40, validMax: 150 },
  { metric: "PRESSURE", unit: "bar", validMin: 0, validMax: 25 },
];
const saved = {
  id: "manual",
  assetId: ASSET,
  metric: "TEMPERATURE",
  value: 21.5,
  unit: "°C",
  measuredAt: "2026-10-01T08:00:00Z",
  recordedAt: "2026-10-28T08:00:00Z",
  source: "MANUAL",
  recordedByUserId: "crew",
  recordedByName: "Alex",
};
const chooseAsset = /Choose asset/;
const pump = /PUMP-001/;
const retiredPump = /OLD-001/;
let fail = false;

beforeEach(() => {
  vi.resetAllMocks();
  permission.canRecord = true;
  fail = false;
  get.mockImplementation((path: string) =>
    Promise.resolve({
      data: path.endsWith("/metrics")
        ? METRICS
        : {
            items: [
              {
                id: ASSET,
                reference: "PUMP-001",
                name: "Water pump",
                retired: false,
              },
              {
                id: "retired",
                reference: "OLD-001",
                name: "Old pump",
                retired: true,
              },
            ],
            page: 0,
            size: 50,
            totalItems: 2,
          },
      response: new Response(),
    })
  );
  post.mockImplementation(() =>
    Promise.resolve(
      fail
        ? {
            error: { message: "Connection failed. Try again." },
            response: new Response(null, { status: 503 }),
          }
        : { data: saved, response: new Response(null, { status: 201 }) }
    )
  );
});
function show(initialAssetId: string | undefined = ASSET) {
  const onSaved = vi.fn();
  const view = renderWithProviders(
    <ManualReadingForm
      estateId="estate"
      initialAssetId={initialAssetId}
      initialMetric="TEMPERATURE"
      onSaved={onSaved}
    />
  );
  return { ...view, onSaved };
}
async function fill(value = "21.5") {
  await screen.findByRole("spinbutton", { name: "Value" });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Value" }), {
    target: { value },
  });
  fireEvent.change(screen.getByLabelText("Measured at"), {
    target: { value: "2026-10-01T16:00" },
  });
}

describe("manual reading form", () => {
  it.each([
    ["00021.5000000", "21.5"],
    ["1e-6", "0.000001"],
    ["-0", "0"],
    ["1.2e3", "1200"],
  ])("canonicalizes %s exactly as %s", async (input, expected) => {
    const { onSaved } = show();
    await fill(input);
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(post.mock.calls[0][1].body.value).toBe(expected);
  });
  it("keeps retry identity for equivalent decimal text", async () => {
    fail = true;
    show();
    await fill("21.5");
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await screen.findByText("Connection failed. Try again.");
    const first = post.mock.calls[0][1].body.submissionId;
    await fill("021.5000000");
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1].body.submissionId).toBe(first);
    expect(post.mock.calls[1][1].body.value).toBe("21.5");
  });
  it.each([
    "999999999999.123456",
    "999999999999.999999",
    "-999999999999.123456",
    "0.000001",
  ])("sends %s as exact decimal text without losing digits", async (value) => {
    const { onSaved } = show();
    await fill(value);
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(post.mock.calls[0][1].body.value).toBe(value);
  });
  it("rejects excess decimal precision clearly without changing the entered value", async () => {
    show();
    await fill("1.0000001");
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await screen.findByText("Value can have at most six decimal places.");
    expect(post).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("spinbutton", { name: "Value" }) as HTMLInputElement)
        .value
    ).toBe("1.0000001");
  });
  it("changes retry identity when only the last large-decimal digit changes", async () => {
    fail = true;
    show();
    await fill("999999999999.123456");
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await screen.findByText("Connection failed. Try again.");
    const first = post.mock.calls[0][1].body.submissionId;
    await fill("999999999999.123457");
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1].body.submissionId).not.toBe(first);
    expect(post.mock.calls[1][1].body.value).toBe("999999999999.123457");
  });
  it("defaults time to now and displays the server's unit and expected range", async () => {
    const before = Date.now();
    show();
    await screen.findByRole("spinbutton", { name: "Value" });
    const input = screen.getByLabelText("Measured at") as HTMLInputElement;
    expect(Math.abs(new Date(input.value).getTime() - before)).toBeLessThan(
      61_000
    );
    screen.getByText("Unit: °C · Expected range: -40 to 150 °C");
  });
  it("requires an asset, metric and value and does not submit an empty form", async () => {
    show(undefined);
    await screen.findByRole("spinbutton", { name: "Value" });
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    expect(post).not.toHaveBeenCalled();
  });
  it("selects an active asset without opening the owner-only asset register", async () => {
    show(undefined);
    await screen.findByRole("spinbutton", { name: "Value" });
    fireEvent.click(screen.getByRole("button", { name: chooseAsset }));
    const retired = await screen.findByRole("button", { name: retiredPump });
    expect(retired.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "All assets" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: pump }));
    await fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(
      get.mock.calls.every(([path]) => String(path).includes("/readings/"))
    ).toBe(true);
  });
  it("sends local time as UTC with server unit and invalidates affected reading caches", async () => {
    const { onSaved, queryClient } = show();
    queryClient.setQueryData(["crew", "estate-readings", "estate", {}], {
      old: true,
    });
    queryClient.setQueryData(
      [...assetQueryKey("crew", "estate", ASSET), "readings", {}],
      { old: true }
    );
    await fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(post).toHaveBeenCalledWith("/estates/{estateId}/readings/manual", {
      params: { path: { estateId: "estate" } },
      body: expect.objectContaining({
        assetId: ASSET,
        metric: "TEMPERATURE",
        value: "21.5",
        unit: "°C",
        measuredAt: new Date("2026-10-01T16:00").toISOString(),
        submissionId: expect.any(String),
      }),
    });
    expect(
      queryClient.getQueryState(["crew", "estate-readings", "estate", {}])
        ?.isInvalidated
    ).toBe(true);
    expect(
      queryClient.getQueryState([
        ...assetQueryKey("crew", "estate", ASSET),
        "readings",
        {},
      ])?.isInvalidated
    ).toBe(true);
  });
  it("warns about out-of-range values but allows saving them", async () => {
    const { onSaved } = show();
    await fill("151");
    await screen.findByText(
      "Outside the expected range. You can still save this measurement; it will be flagged for review."
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
  it("changes unit and expected range when the metric changes", async () => {
    show();
    await screen.findByRole("spinbutton", { name: "Value" });
    await chooseOption(
      screen.getByRole("combobox", { name: "Metric" }),
      "Pressure"
    );
    screen.getByText("Unit: bar · Expected range: 0 to 25 bar");
  });
  it("preserves fields and submission identity for an uncertain retry, but changes identity for an edited entry", async () => {
    fail = true;
    const { onSaved } = show();
    await fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await screen.findByText("Connection failed. Try again.");
    const first = post.mock.calls[0][1].body.submissionId;
    expect(
      (screen.getByRole("spinbutton", { name: "Value" }) as HTMLInputElement)
        .value
    ).toBe("21.5");
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    await screen.findByText("Connection failed. Try again.");
    expect(post.mock.calls[1][1].body.submissionId).toBe(first);
    fail = false;
    fireEvent.change(screen.getByRole("spinbutton", { name: "Value" }), {
      target: { value: "22" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(post.mock.calls[2][1].body.submissionId).not.toBe(first);
  });
  it("explains network save failures clearly and keeps the entered value", async () => {
    post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    show();
    await fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await screen.findByText(
      "Could not save the reading. Check your connection and try again. Your entries have been kept."
    );
    expect(
      (screen.getByRole("spinbutton", { name: "Value" }) as HTMLInputElement)
        .value
    ).toBe("21.5");
  });

  it("disables save while pending to prevent double submission", async () => {
    post.mockImplementation(
      () =>
        new Promise(() => {
          /* Intentionally keep the response pending. */
        })
    );
    show();
    await fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Save manual reading" })
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Saving reading…" })
          .hasAttribute("disabled")
      ).toBe(true)
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("hides the form immediately when recording access is revoked", async () => {
    const { rerender, onSaved } = show();
    await screen.findByRole("spinbutton", { name: "Value" });
    permission.canRecord = false;
    rerender(
      <ManualReadingForm
        estateId="estate"
        initialAssetId={ASSET}
        initialMetric="TEMPERATURE"
        onSaved={onSaved}
      />
    );
    screen.getByText("Manual reading entry is not available for this estate.");
    expect(
      screen.queryByRole("button", { name: "Save manual reading" })
    ).toBeNull();
  });
});
