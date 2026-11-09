import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetServiceIntervalCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-service-interval-card";
import { SourceBadge } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/source-badge";

const CASEY = /Casey Doe/u;

const none = {
  effective: null,
  source: "NONE",
  override: null,
  categoryInterval: null,
  categoryLabel: "Pump",
  lastOverrideChange: null,
};
const fromCategory = {
  ...none,
  effective: { value: 6, unit: "MONTH" },
  source: "CATEGORY",
  categoryInterval: { value: 6, unit: "MONTH" },
};
const overridden = {
  ...fromCategory,
  effective: { value: 90, unit: "DAY" },
  source: "ASSET",
  override: { value: 90, unit: "DAY" },
  lastOverrideChange: {
    interval: { value: 90, unit: "DAY" },
    changedByUserId: "owner",
    changedByName: "Casey Doe",
    changedAt: "2026-10-20T04:00:00Z",
  },
};

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: null as Error | null,
  save: vi.fn(),
}));

beforeEach(() => {
  state.data = fromCategory;
  state.error = null;
  state.save = vi.fn(() => Promise.resolve());
});

vi.mock("@/lib/service-intervals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/service-intervals")>()),
  useAssetServiceInterval: () => ({
    data: state.data,
    error: state.error,
    isPending: !(state.data || state.error),
  }),
  useSetAssetServiceInterval: () => ({
    mutateAsync: state.save,
    isPending: false,
  }),
}));

function card() {
  return within(screen.getByRole("region", { name: "Service interval" }));
}

it.each([
  [
    none,
    "Not set",
    "No interval",
    "Neither this asset nor the Pump category has an interval.",
  ],
  [
    fromCategory,
    "Every 6 months",
    "From category",
    "Inherited from the Pump category.",
  ],
  [
    overridden,
    "Every 90 days",
    "Custom",
    "Replaces the Pump interval (every 6 months).",
  ],
  [
    { ...overridden, categoryInterval: null },
    "Every 90 days",
    "Custom",
    "The Pump category has no interval.",
  ],
])(
  "leads with the interval and says where it comes from (%#)",
  (data, interval, source, explanation) => {
    state.data = data;
    renderWithProviders(<AssetServiceIntervalCard assetId="a" estateId="e" />);
    expect(card().getByText(interval).tagName).toBe("P");
    card().getByText(source);
    card().getByText(explanation);
  }
);

it("shows who last changed the override", () => {
  state.data = overridden;
  renderWithProviders(<AssetServiceIntervalCard assetId="a" estateId="e" />);
  expect(card().getByText(CASEY).textContent).toContain(
    "Custom interval last changed by Casey Doe"
  );
});

it("overrides the category's interval", async () => {
  renderWithProviders(<AssetServiceIntervalCard assetId="a" estateId="e" />);
  expect(card().queryByRole("button", { name: "Remove override" })).toBeNull();
  fireEvent.click(
    card().getByRole("button", { name: "Set a custom interval" })
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Set a custom interval" })
  );
  fireEvent.change(dialog.getByRole("spinbutton", { name: "Every" }), {
    target: { value: "2" },
  });
  await chooseOption(dialog.getByRole("combobox", { name: "Unit" }), "Years");
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(state.save).toHaveBeenCalledWith({ value: 2, unit: "YEAR" })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("edits or removes an existing override", async () => {
  state.data = overridden;
  renderWithProviders(<AssetServiceIntervalCard assetId="a" estateId="e" />);
  card().getByRole("button", { name: "Edit custom interval" });
  fireEvent.click(card().getByRole("button", { name: "Remove override" }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(null));
});

it("shows a failed removal", async () => {
  state.data = overridden;
  state.save = vi.fn(() => Promise.reject(new Error("This asset is retired.")));
  renderWithProviders(<AssetServiceIntervalCard assetId="a" estateId="e" />);
  fireEvent.click(card().getByRole("button", { name: "Remove override" }));
  expect((await card().findByRole("alert")).textContent).toContain(
    "This asset is retired."
  );
});

it("locks the override with a reason", () => {
  state.data = overridden;
  renderWithProviders(
    <AssetServiceIntervalCard
      assetId="a"
      estateId="e"
      locked="This asset is out of use, so you can't change how often it's serviced."
    />
  );
  card().getByText(
    "This asset is out of use, so you can't change how often it's serviced."
  );
  for (const name of ["Edit custom interval", "Remove override"]) {
    expect(card().getByRole("button", { name }).hasAttribute("disabled")).toBe(
      true
    );
  }
});

it("shows a load error", () => {
  state.data = undefined;
  state.error = new Error("Asset not found.");
  renderWithProviders(<AssetServiceIntervalCard assetId="a" estateId="e" />);
  expect(card().getByRole("alert").textContent).toContain("Asset not found.");
});

it("marks an override with the warning badge", () => {
  renderWithProviders(<SourceBadge interval={overridden as never} />);
  expect(screen.getByText("Custom").dataset.variant).toBe("warning");
});
