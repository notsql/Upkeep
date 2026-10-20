import { fireEvent } from "@testing-library/react";
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
import type { AssetReadingPage, ReadingFilters } from "@/lib/readings";
import { ReadingsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/readings-page";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/estates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estates")>()),
  useEstate: () => ({ data: { id: "estate-id", name: "Maple Grove" } }),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({ data: { id: "asset-id", name: "Water pump" } }),
}));

const DEVICE_ROW = /PUMP-01/;
const READINGS_PATH = "/estates/{estateId}/assets/{assetId}/readings";

let readingPage: AssetReadingPage;

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    Promise.resolve({
      data: path === READINGS_PATH ? readingPage : undefined,
      response: new Response(),
    })) as never);
}

function renderPage(filters: ReadingFilters = {}) {
  const onFiltersChange = vi.fn();
  renderWithProviders(
    <ReadingsPage
      assetId="asset-id"
      estateId="estate-id"
      filters={filters}
      onFiltersChange={onFiltersChange}
    />
  );
  return onFiltersChange;
}

const reading = {
  id: "r1",
  measuredAt: "2026-10-01T08:00:00Z",
  metric: "TEMPERATURE" as const,
  unit: "°C",
  value: 151.5,
  deviceId: "d1",
  deviceIdentifier: "PUMP-01",
  flags: [
    { type: "GAP" as const, gapSeconds: 7500 },
    { type: "DUPLICATE_TIMESTAMP" as const },
    { type: "OUT_OF_RANGE" as const, validMin: -40, validMax: 150 },
  ],
};

describe("ReadingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    readingPage = { items: [reading], page: 0, size: 50, totalItems: 1 };
    serve();
  });

  it("lists readings with unit, device and a badge per flag", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Readings" });
    const row = within(table).getByRole("row", { name: DEVICE_ROW });
    within(row).getByText("151.5 °C");
    within(row).getByText("Temperature");
    within(row).getByText(new Date(reading.measuredAt).toLocaleString());
    within(row).getByText("Gap 2h 5m");
    within(row).getByText("Duplicate timestamp");
    within(row).getByText("Out of range (valid -40 to 150 °C)");
  });

  it("says when the asset has no readings yet", async () => {
    readingPage = { items: [], page: 0, size: 50, totalItems: 0 };
    renderPage();
    await screen.findByText("No readings yet");
  });

  it("says when filters match nothing", async () => {
    readingPage = { items: [], page: 0, size: 50, totalItems: 0 };
    renderPage({ metric: "HUMIDITY" });
    await screen.findByText("No readings match these filters");
  });

  it("says when no suspect readings match", async () => {
    readingPage = { items: [], page: 0, size: 50, totalItems: 0 };
    renderPage({ suspect: true, metric: "HUMIDITY" });
    await screen.findByText("No suspect readings match");
  });

  it("turns on suspect only and returns to the first page", async () => {
    const change = renderPage({ page: 3 });
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Suspect only" })
    );
    expect(change).toHaveBeenCalledWith({ suspect: true, page: undefined });
  });

  it("filters by metric and returns to the first page", async () => {
    const change = renderPage({ page: 2 });
    await chooseOption(
      await screen.findByRole("combobox", { name: "Metric" }),
      "Pressure"
    );
    expect(change).toHaveBeenCalledWith({
      metric: "PRESSURE",
      page: undefined,
    });
  });

  it("filters by time and returns to the first page", async () => {
    const change = renderPage({ page: 2 });
    fireEvent.change(await screen.findByLabelText("From"), {
      target: { value: "2026-10-01T08:00" },
    });
    expect(change).toHaveBeenCalledWith({
      from: "2026-10-01T08:00",
      page: undefined,
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-10-02T08:00" },
    });
    expect(change).toHaveBeenCalledWith({
      to: "2026-10-02T08:00",
      page: undefined,
    });
  });

  it("pages forward and back, disabled at the ends", async () => {
    readingPage = { items: [reading], page: 1, size: 50, totalItems: 120 };
    const change = renderPage({ page: 1 });
    await screen.findByText("Page 2 of 3 · 120 readings");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(change).toHaveBeenCalledWith({ page: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(change).toHaveBeenCalledWith({ page: 0 });
  });

  it("disables previous on the first page and next on the last", async () => {
    readingPage = { items: [reading], page: 0, size: 50, totalItems: 1 };
    renderPage();
    await screen.findByText("Page 1 of 1 · 1 reading");
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Previous page" })
          .hasAttribute("disabled")
      ).toBe(true)
    );
    expect(
      screen.getByRole("button", { name: "Next page" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("shows the server's message when listing fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "from must be before to" },
      response: new Response(null, { status: 400 }),
    } as never);
    renderPage();
    await screen.findByText("from must be before to");
  });
});
