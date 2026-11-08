import { Button } from "@proj/ui/components/button";
import { fireEvent } from "@testing-library/react";
import { historyPage, invoiceEntry } from "@tests/fixtures/asset-history";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { useCallback } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useRecordAssetEvent } from "@/lib/asset-events";
import { useDeleteDocument } from "@/lib/documents";
import { AssetHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/_details/history/-components/asset-history-page";

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@/lib/access", () => ({
  useAuthenticatedSession: () => ({ userId: "owner", ready: true }),
  useAppAccess: () => ({
    isPending: false,
    isError: false,
    data: {
      estates: [
        {
          estateId: "estate",
          canViewAssetHistory: true,
          canViewDocuments: true,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

function SourceMutations() {
  const record = useRecordAssetEvent("estate", "pump");
  const remove = useDeleteDocument("estate");
  const recordMaintenance = useCallback(
    () =>
      record.mutate({
        type: "PREVENTIVE",
        occurredOn: "2026-03-01",
        notes: "Serviced",
      }),
    [record.mutate]
  );
  const deleteInvoice = useCallback(
    () => remove.mutate("invoice"),
    [remove.mutate]
  );
  return (
    <>
      <Button onClick={recordMaintenance}>Record maintenance</Button>
      <Button onClick={deleteInvoice}>Delete invoice</Button>
      <AssetHistoryPage assetId="pump" estateId="estate" />
    </>
  );
}

beforeEach(() => vi.resetAllMocks());

it("restarts history at its first page after a maintenance write", async () => {
  let saved = false;
  vi.mocked(api.GET).mockImplementation((_path: string, options: unknown) => {
    const cursor = (options as { params?: { query?: { cursor?: string } } })
      .params?.query?.cursor;
    return Promise.resolve({
      data: saved
        ? {
            ...historyPage,
            items: [{ ...invoiceEntry, title: "Refreshed history" }],
          }
        : {
            ...historyPage,
            items: cursor
              ? [
                  {
                    ...invoiceEntry,
                    id: "INVOICE:older",
                    title: "Older history",
                  },
                ]
              : [invoiceEntry],
            nextCursor: cursor ? null : "older",
          },
      response: new Response(),
    } as never);
  });
  vi.mocked(api.POST).mockImplementation(() => {
    saved = true;
    return Promise.resolve({
      data: { id: "repair" },
      response: new Response(null, { status: 201 }),
    } as never);
  });
  renderWithProviders(<SourceMutations />);
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByRole("heading", { name: "Older history" });
  fireEvent.click(screen.getByRole("button", { name: "Record maintenance" }));
  await screen.findByRole("heading", { name: "Refreshed history" });
  expect(screen.queryByRole("heading", { name: "Older history" })).toBeNull();
});

it("removes a deleted invoice from an already loaded timeline", async () => {
  let deleted = false;
  vi.mocked(api.GET).mockImplementation(
    async () =>
      ({
        data: { ...historyPage, items: deleted ? [] : [invoiceEntry] },
        response: new Response(),
      }) as never
  );
  vi.mocked(api.DELETE).mockImplementation(() => {
    deleted = true;
    return Promise.resolve({
      response: new Response(null, { status: 204 }),
    } as never);
  });
  renderWithProviders(<SourceMutations />);
  await screen.findByRole("button", { name: "Open invoice report.pdf" });
  fireEvent.click(screen.getByRole("button", { name: "Delete invoice" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Invoice uploaded" })
    ).toBeNull()
  );
  await screen.findByText("No recorded history");
});
