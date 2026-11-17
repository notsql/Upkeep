import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AssetRetirementPanel } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-retirement-panel/asset-retirement-panel";

vi.mock(
  "@/components/forms/date-picker",
  () => import("@tests/date-picker-stubs")
);
vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
const asset = {
  id: "a",
  estateId: "e",
  reference: "E-A0001",
  name: "Pump",
  category: "PUMP" as const,
  locationId: "l",
  locationPath: "Block A",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  deactivatedAt: "2026-01-01",
  retiredOn: "2025-01-01",
  retirementReason: "Worn out",
  lifecycleVersion: 1,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.GET).mockResolvedValue({
    data: [],
    response: new Response(),
  } as never);
  vi.mocked(api.POST).mockResolvedValue({
    data: { ...asset, deactivatedAt: null, lifecycleVersion: 2 },
    response: new Response(),
  } as never);
  vi.mocked(api.PATCH).mockResolvedValue({
    data: asset,
    response: new Response(),
  } as never);
});
it("restores only after exact reference confirmation using the displayed version", async () => {
  renderWithProviders(<AssetRetirementPanel asset={asset} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore asset" }));
  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "Confirm restoration",
  });
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Asset reference" }), {
    target: { value: "E-A0001" },
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{id}/restore",
      {
        params: { path: { estateId: "e", id: "a" } },
        body: { reference: "E-A0001", expectedVersion: 1 },
      }
    )
  );
});
it("corrects retirement information without changing identity", async () => {
  renderWithProviders(<AssetRetirementPanel asset={asset} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit out-of-use details" })
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Why it's out of use" }),
    {
      target: { value: " Corrected " },
    }
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save retirement information" })
  );
  await waitFor(() =>
    expect(api.PATCH).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{id}/retirement",
      {
        params: { path: { estateId: "e", id: "a" } },
        body: {
          retiredOn: "2025-01-01",
          retirementReason: "Corrected",
          expectedVersion: 1,
        },
      }
    )
  );
});

it("explains an invalid retirement date when correcting information", () => {
  renderWithProviders(
    <AssetRetirementPanel asset={{ ...asset, installedOn: "2024-01-01" }} />
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Edit out-of-use details" })
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Date taken out of use" }),
    {
      target: { value: "2023-12-31" },
    }
  );
  expect(screen.getByRole("alert").textContent).toContain("2024-01-01");
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: "Save retirement information",
    }).disabled
  ).toBe(true);
});

// Correcting and restoring are asset edits (EDIT_ASSETS; estate-role-permissions).
it("offers no correction or restoration to someone who cannot edit assets", () => {
  renderWithProviders(<AssetRetirementPanel asset={asset} canEdit={false} />);
  expect(
    screen.queryByRole("button", { name: "Edit out-of-use details" })
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Restore asset" })).toBeNull();
});

it("shows the out-of-use date formatted, not as a raw value", async () => {
  const { formatDate } = await import("@/lib/format");
  renderWithProviders(<AssetRetirementPanel asset={asset} />);
  screen.getByText(formatDate("2025-01-01"));
  expect(screen.queryByText("2025-01-01")).toBeNull();
});

it("leaves out the previous out-of-use line when there was nothing before", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      {
        id: "event-1",
        action: "RETIRED",
        occurredAt: "2026-11-12T00:27:21Z",
        actorUserId: "owner",
        previousDeactivatedAt: null,
        previousRetiredOn: null,
        previousRetirementReason: null,
        deactivatedAt: "2026-11-12T00:27:21Z",
        retiredOn: "2026-11-12",
        retirementReason: "retired",
        lifecycleVersion: 1,
      },
    ],
    response: new Response(),
  } as never);
  renderWithProviders(<AssetRetirementPanel asset={asset} />);
  await screen.findByText("Result:", { exact: false });
  expect(
    screen.queryByText("Previous out-of-use date", { exact: false })
  ).toBeNull();
});

it("names who changed the asset's lifecycle, not their user ID", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      {
        id: "event-1",
        action: "RETIRED",
        occurredAt: "2026-11-12T00:27:21Z",
        actorUserId: "user_01ABC",
        actorName: "Casey Doe",
        previousDeactivatedAt: null,
        previousRetiredOn: null,
        previousRetirementReason: null,
        deactivatedAt: "2026-11-12T00:27:21Z",
        retiredOn: "2026-11-12",
        retirementReason: "retired",
        lifecycleVersion: 1,
      },
    ],
    response: new Response(),
  } as never);
  renderWithProviders(<AssetRetirementPanel asset={asset} />);
  await screen.findByText("By Casey Doe", { exact: false });
  expect(screen.queryByText("user_01ABC", { exact: false })).toBeNull();
});

it("colours each lifecycle change and its result by meaning", async () => {
  const event = {
    occurredAt: "2026-11-12T00:27:21Z",
    actorUserId: "user_01ABC",
    actorName: "Casey Doe",
    previousDeactivatedAt: null,
    previousRetiredOn: null,
    previousRetirementReason: null,
    deactivatedAt: null,
    retiredOn: null,
    retirementReason: null,
    lifecycleVersion: 1,
  };
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      { ...event, id: "e3", action: "RESTORED" },
      {
        ...event,
        id: "e2",
        action: "CORRECTED",
        deactivatedAt: "2026-11-12T00:27:21Z",
        retiredOn: "2026-11-12",
        retirementReason: "worn out",
      },
      {
        ...event,
        id: "e1",
        action: "RETIRED",
        deactivatedAt: "2026-11-12T00:27:21Z",
        retiredOn: "2026-11-12",
        retirementReason: "retired",
      },
    ],
    response: new Response(),
  } as never);
  renderWithProviders(<AssetRetirementPanel asset={asset} />);
  const list = await screen.findByRole("list", { name: "Lifecycle events" });
  const [restored, corrected, retired] =
    await within(list).findAllByRole("listitem");
  const variant = (item: HTMLElement, text: string) =>
    within(item).getByText(text).dataset.variant;
  expect(variant(restored as HTMLElement, "Restored")).toBe("success");
  expect(variant(restored as HTMLElement, "Active")).toBe("success");
  expect(variant(corrected as HTMLElement, "Out-of-use details changed")).toBe(
    "info"
  );
  // The change and its result both read Out of use, in the same grey.
  const outOfUse = within(retired as HTMLElement).getAllByText("Out of use");
  expect(outOfUse.map((badge) => badge.dataset.variant)).toEqual([
    "secondary",
    "secondary",
  ]);
});
