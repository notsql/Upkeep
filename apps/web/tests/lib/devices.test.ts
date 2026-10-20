import { createElement, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { devicesQueryKey, useIssueDeviceCredential } from "@/lib/devices";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const CREDENTIAL_PATH =
  "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential";
const credential = {
  deviceId: "device-id",
  apiKey: `upk_${"A".repeat(42)}w`,
  issuedAt: "2026-10-10T00:00:00Z",
};

// Module scope: never define a component inside another component.
function IssueProbe() {
  const issue = useIssueDeviceCredential("estate-id", "asset-id");
  const { mutate } = issue;
  useEffect(() => mutate("device-id"), [mutate]);
  if (issue.error) {
    return createElement("p", { role: "alert" }, issue.error.message);
  }
  return issue.data ? createElement("output", null, issue.data.apiKey) : null;
}

describe("useIssueDeviceCredential", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("issues a key for the device and refreshes the asset's device list", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      data: credential,
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(IssueProbe));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByText(credential.apiKey);
    expect(api.POST).toHaveBeenCalledWith(CREDENTIAL_PATH, {
      params: {
        path: {
          estateId: "estate-id",
          assetId: "asset-id",
          deviceId: "device-id",
        },
      },
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: devicesQueryKey("owner", "estate-id", "asset-id"),
      })
    );
  });

  it("reports the server's message when issuing fails", async () => {
    vi.mocked(api.POST).mockResolvedValue({
      error: {
        message: "This asset is retired. Device credentials cannot be issued.",
      },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWithProviders(createElement(IssueProbe));
    await screen.findByRole("alert");
  });
});
