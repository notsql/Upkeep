import { fireEvent } from "@testing-library/react";
import {
  historyAsset,
  historyPage,
  invoiceEntry,
} from "@tests/fixtures/asset-history";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AssetHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/_details/history/-components/asset-history-page";

const state = vi.hoisted(() => ({
  userId: "council",
  allowed: true,
  documents: true,
}));
vi.mock("@/lib/access", () => ({
  useAuthenticatedSession: () => ({ userId: state.userId, ready: true }),
  useAppAccess: () => ({
    isPending: false,
    isError: false,
    data: {
      estates: [
        {
          estateId: "estate",
          canViewAssetHistory: state.allowed,
          canViewDocuments: state.documents,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

beforeEach(() => {
  state.userId = "council";
  state.allowed = true;
  state.documents = true;
  vi.mocked(api.GET).mockReset();
  vi.mocked(api.GET).mockImplementation(
    async (path: string) =>
      ({
        data: path.endsWith("/content")
          ? new Blob(["pdf"], { type: "application/pdf" })
          : historyPage,
        response: new Response(),
      }) as never
  );
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:history"),
      revokeObjectURL: vi.fn(),
    })
  );
});

describe("asset history", () => {
  it("shows a semantic mixed timeline with upload chronology, date-only precision and anomaly provenance", async () => {
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    const timeline = await screen.findByRole("list", {
      name: "Recorded asset history",
    });
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(2);
    within(timeline).getByRole("heading", { name: "Invoice uploaded" });
    within(timeline).getByText("Anomaly detection");
    within(timeline).getByText("Needs attention");
    expect(
      within(timeline)
        .getAllByRole("time")
        .map((time) => time.getAttribute("datetime"))
    ).toEqual(["2026-03-01T16:30:00Z", "2026-03-01"]);
    expect(within(timeline).getAllByRole("time")[0].textContent).toContain(
      "00:30"
    );
    expect(
      screen.queryByRole("link", { name: "Record inspection" })
    ).toBeNull();
    expect(api.GET).not.toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{id}",
      expect.anything()
    );
  });

  it("keeps loaded entries when loading another page fails and retries that page", async () => {
    vi.mocked(api.GET)
      .mockResolvedValueOnce({
        data: { ...historyPage, nextCursor: "older" },
        response: new Response(),
      } as never)
      .mockResolvedValueOnce({
        error: { message: "Older history unavailable" },
        response: new Response(null, { status: 500 }),
      } as never)
      .mockResolvedValueOnce({
        data: {
          ...historyPage,
          items: [
            {
              ...invoiceEntry,
              id: "INVOICE:older",
              sourceId: "older",
              title: "Older invoice uploaded",
            },
          ],
          nextCursor: null,
        },
        response: new Response(),
      } as never);
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByRole("alert");
    screen.getByRole("heading", { name: "Invoice uploaded" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: "Older invoice uploaded" });
    expect(
      within(
        screen.getByRole("list", { name: "Recorded asset history" })
      ).getAllByRole("listitem")
    ).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("fetches a file only on open and restores focus to its entry on close", async () => {
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    const open = await screen.findByRole("button", {
      name: "Open invoice report.pdf",
    });
    expect(api.GET).not.toHaveBeenCalledWith(
      "/estates/{estateId}/documents/{documentId}/content",
      expect.anything()
    );
    fireEvent.click(open);
    const dialog = await screen.findByRole("dialog", {
      name: "Invoice: report.pdf",
    });
    await within(dialog).findByTitle("Preview report.pdf");
    within(dialog).getByRole("button", { name: "Download" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(open));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:history");
    screen.getByRole("heading", { name: "Condition assessed" });
  });

  it("keeps history usable during a file outage and allows the file request to be retried", async () => {
    vi.mocked(api.GET).mockImplementation(
      async (path: string) =>
        ({
          ...(path.endsWith("/content")
            ? {
                error: { message: "File temporarily unavailable" },
                response: new Response(null, { status: 503 }),
              }
            : { data: historyPage, response: new Response() }),
        }) as never
    );
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Open invoice report.pdf" })
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("alert");
    vi.mocked(api.GET).mockResolvedValue({
      data: new Blob(["pdf"], { type: "application/pdf" }),
      response: new Response(),
    } as never);
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    await within(dialog).findByTitle("Preview report.pdf");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await screen.findByRole("heading", { name: "Condition assessed" });
  });

  it("offers download when browser preview fails", async () => {
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Open invoice report.pdf" })
    );
    const preview = await screen.findByTitle("Preview report.pdf");
    fireEvent.error(preview);
    await screen.findByText(
      "Preview unavailable. Download the original file to read it."
    );
    screen.getByRole("button", { name: "Download" });
  });

  it("isolates account and asset results and closes an open viewer when scope changes", async () => {
    const view = renderWithProviders(
      <AssetHistoryPage assetId="pump" estateId="estate" />
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Open invoice report.pdf" })
    );
    await screen.findByTitle("Preview report.pdf");
    state.userId = "other";
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        ...historyPage,
        asset: { ...historyAsset, id: "lift", name: "Lift" },
        items: [],
      },
      response: new Response(),
    } as never);
    view.rerender(<AssetHistoryPage assetId="lift" estateId="estate" />);
    await screen.findByText("No recorded history");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Invoice uploaded" })
    ).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:history");
  });

  it("clears inaccessible UI and stops reads after permission loss", async () => {
    const view = renderWithProviders(
      <AssetHistoryPage assetId="pump" estateId="estate" />
    );
    await screen.findByRole("button", { name: "Open invoice report.pdf" });
    state.allowed = false;
    view.rerender(<AssetHistoryPage assetId="pump" estateId="estate" />);
    await screen.findByText("You do not have access to this asset’s history.");
    expect(
      screen.queryByRole("list", { name: "Recorded asset history" })
    ).toBeNull();
  });

  it("hides cached document metadata and closes its viewer when document access is revoked", async () => {
    const view = renderWithProviders(
      <AssetHistoryPage assetId="pump" estateId="estate" />
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Open invoice report.pdf" })
    );
    await screen.findByTitle("Preview report.pdf");
    state.documents = false;
    view.rerender(<AssetHistoryPage assetId="pump" estateId="estate" />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.queryByRole("heading", { name: "Invoice uploaded" })
    ).toBeNull();
    expect(screen.queryByText("report.pdf")).toBeNull();
    screen.getByRole("heading", { name: "Condition assessed" });
    screen.getByText(
      "Document entries are hidden because you do not have document access."
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:history");
  });

  it("explains empty recorded history and distinguishes it from loading and errors", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...historyPage, items: [] },
      response: new Response(),
    } as never);
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    await screen.findByText("No recorded history");
    screen.getByText(
      "History contains recorded activity only. Older activity may not have been recorded."
    );
  });

  it("shows initial read failure with retry", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "History unavailable" },
      response: new Response(null, { status: 500 }),
    } as never);
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    await screen.findByRole("alert");
    screen.getByRole("button", { name: "Retry" });
    expect(screen.queryByText("No recorded history")).toBeNull();
  });

  it("distinguishes hidden documents from an asset with no attachments", async () => {
    state.documents = false;
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...historyPage, documentsVisible: false, items: [] },
      response: new Response(),
    } as never);
    renderWithProviders(<AssetHistoryPage assetId="pump" estateId="estate" />);
    await screen.findByText(
      "Document entries are hidden because you do not have document access."
    );
    expect(
      screen.queryByRole("button", { name: "Open invoice report.pdf" })
    ).toBeNull();
  });
});
