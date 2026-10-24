import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { estateDevicesQueryKey, useEstateDevices } from "@/lib/devices";
import { renderWithProviders, screen } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

function Probe() {
  const devices = useEstateDevices("estate-id");
  return devices.data
    ? createElement("output", null, `${devices.data.length} devices`)
    : null;
}

describe("useEstateDevices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.GET).mockResolvedValue({
      data: [],
      response: new Response(),
    } as never);
  });

  it("loads the estate's devices under the user's key and polls every minute", async () => {
    const { queryClient } = renderWithProviders(createElement(Probe));
    await screen.findByText("0 devices");
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: estateDevicesQueryKey("manager", "estate-id") });
    expect(query?.options).toMatchObject({ refetchInterval: 60_000 });
  });
});
