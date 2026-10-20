import { createApiClient } from "@proj/api";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  formatGap,
  type ReadingFilters,
  readingsQueryKey,
  useReadings,
} from "@/lib/readings";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const READINGS_PATH = "/estates/{estateId}/assets/{assetId}/readings";
const emptyPage = { items: [], page: 0, size: 50, totalItems: 0 };

function ReadingsProbe({ filters }: { filters: ReadingFilters }) {
  const readings = useReadings("estate-id", "asset-id", filters);
  if (readings.error) {
    return createElement("p", { role: "alert" }, readings.error.message);
  }
  return readings.data
    ? createElement("output", null, `${readings.data.totalItems} readings`)
    : null;
}

describe("useReadings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("asks for every suspect flag and converts local times to instants", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: emptyPage,
      response: new Response(),
    } as never);
    renderWithProviders(
      createElement(ReadingsProbe, {
        filters: {
          metric: "TEMPERATURE",
          from: "2026-10-01T08:00",
          to: "2026-10-02T08:00",
          suspect: true,
          page: 2,
        },
      })
    );
    await screen.findByText("0 readings");
    expect(api.GET).toHaveBeenCalledWith(READINGS_PATH, {
      params: {
        path: { estateId: "estate-id", assetId: "asset-id" },
        query: {
          metric: "TEMPERATURE",
          from: new Date("2026-10-01T08:00").toISOString(),
          to: new Date("2026-10-02T08:00").toISOString(),
          flag: ["GAP", "DUPLICATE_TIMESTAMP", "OUT_OF_RANGE"],
          page: 2,
          size: 50,
        },
      },
    });
  });

  it("sends no flag when suspect only is off", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: emptyPage,
      response: new Response(),
    } as never);
    renderWithProviders(createElement(ReadingsProbe, { filters: {} }));
    await screen.findByText("0 readings");
    expect(api.GET).toHaveBeenCalledWith(READINGS_PATH, {
      params: {
        path: { estateId: "estate-id", assetId: "asset-id" },
        query: { page: 0, size: 50 },
      },
    });
  });

  it("throws the server's message when listing fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "from must be before to" },
      response: new Response(null, { status: 400 }),
    } as never);
    renderWithProviders(createElement(ReadingsProbe, { filters: {} }));
    await screen.findByRole("alert");
  });

  it("keys the cache under the asset, like the other asset queries", () => {
    expect(readingsQueryKey("owner", "e", "a", { page: 1 })).toEqual([
      "estates",
      "owner",
      "assets",
      "e",
      "a",
      "readings",
      { page: 1 },
    ]);
  });
});

describe("flag query serialisation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("repeats the flag parameter once per flag", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(emptyPage, {
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient({ baseUrl: "http://api.test" });
    await client.GET(READINGS_PATH, {
      params: {
        path: { estateId: "e", assetId: "a" },
        query: { flag: ["GAP", "OUT_OF_RANGE"] },
      },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const request = (fetchMock.mock.calls[0] as unknown[])[0] as Request;
    expect(new URL(request.url).search).toBe("?flag=GAP&flag=OUT_OF_RANGE");
  });
});

describe("formatGap", () => {
  it("reads as days, hours, minutes and seconds, skipping zeros", () => {
    expect(formatGap(7500)).toBe("2h 5m");
    expect(formatGap(90)).toBe("1m 30s");
    expect(formatGap(90_000)).toBe("1d 1h");
    expect(formatGap(45)).toBe("45s");
  });
});
