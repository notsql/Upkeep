import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/assessments";
import { formatDate } from "@/lib/format";
import { AssetAttentionAlert } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-attention-alert";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

let history: Assessment[];

function current(
  condition: Assessment["condition"],
  recordedByUserId = "system:anomaly-model"
): Assessment {
  return {
    id: "a1",
    assetId: "asset",
    condition,
    assessedOn: "2026-11-08",
    notes: "Bearing noise rising.",
    recordedByUserId,
    recordedByName: "Casey Doe",
    recordedAt: "2026-11-08T02:00:00Z",
  };
}

function renderAlert(canInspect = true) {
  return renderWithProviders(
    <AssetAttentionAlert
      assetId="asset"
      canInspect={canInspect}
      estateId="estate"
    />
  );
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  history = [current("NEEDS_ATTENTION")];
  vi.mocked(api.GET).mockImplementation((() =>
    Promise.resolve({ data: history, response: new Response() })) as never);
});

describe("AssetAttentionAlert", () => {
  it("says who flagged the asset and when, with a link to file an inspection", async () => {
    renderAlert();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Needs attention");
    expect(alert.textContent).toContain(
      `flagged by Anomaly detection on ${formatDate("2026-11-08")}`
    );
    expect(
      within(alert)
        .getByRole("link", { name: "File an inspection" })
        .getAttribute("href")
    ).toBe("/estates/estate/assets/asset/inspections/new");
  });

  it("shows for a faulty asset and names the person who recorded it", async () => {
    history = [current("FAULTY", "user_1")];
    renderAlert();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Faulty");
    expect(alert.textContent).toContain("flagged by Casey Doe");
  });

  it("stays hidden for an asset in good condition", async () => {
    history = [current("GOOD")];
    const { queryClient } = renderAlert();
    await waitFor(() => expect(api.GET).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still shows the condition, without the button, to a viewer who cannot file an inspection", async () => {
    renderAlert(false);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Needs attention");
    expect(
      screen.queryByRole("link", { name: "File an inspection" })
    ).toBeNull();
  });

  it("includes the assessment's note", async () => {
    renderAlert();
    const alert = await screen.findByRole("alert");
    within(alert).getByText("Bearing noise rising.");
  });

  it.each([
    ["NEEDS_ATTENTION", "warning"],
    ["FAULTY", "destructive"],
  ] as const)("tones a %s banner as %s", async (condition, tone) => {
    history = [current(condition)];
    renderAlert();
    const alert = await screen.findByRole("alert");
    expect(alert.dataset.tone).toBe(tone);
  });
});
