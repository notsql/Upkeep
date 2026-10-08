import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AssetRetirementPanel } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-retirement-panel";

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
    screen.getByRole("button", { name: "Edit retirement information" })
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Retirement reason" }), {
    target: { value: " Corrected " },
  });
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
    screen.getByRole("button", { name: "Edit retirement information" })
  );
  fireEvent.change(screen.getByLabelText("Retirement date"), {
    target: { value: "2023-12-31" },
  });
  expect(screen.getByRole("alert").textContent).toContain("2024-01-01");
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: "Save retirement information",
    }).disabled
  ).toBe(true);
});
