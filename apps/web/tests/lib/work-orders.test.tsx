import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { useCallback } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useCreateWorkOrder, useWorkOrderList } from "@/lib/work-orders";

const state = vi.hoisted(() => ({
  userId: "manager",
  canView: true,
  canCreate: true,
}));
vi.mock("@/lib/access", () => ({
  useAuthenticatedSession: () => ({ userId: state.userId, ready: true }),
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "oak",
          canViewWorkOrders: state.canView,
          canCreateWorkOrders: state.canCreate,
        },
      ],
    },
    isError: false,
    isPending: false,
  }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
function Orders() {
  const list = useWorkOrderList("oak");
  const create = useCreateWorkOrder("oak");
  const save = useCallback(
    () =>
      create.mutate({
        description: "Leak",
        locationId: "level",
        category: "CLEANLINESS",
        priority: "LOW",
        source: "MANUAL",
      }),
    [create.mutate]
  );
  return (
    <>
      <p>{list.isError ? "Unavailable" : list.data?.items[0]?.reference}</p>
      <button onClick={save} type="button">
        Save
      </button>
      {create.isError ? <p>Save failed</p> : null}
      {create.isSuccess ? <p>Saved</p> : null}
    </>
  );
}

function SortPreview({
  estateId,
  descending,
}: {
  estateId: string;
  descending: boolean;
}) {
  const list = useWorkOrderList(estateId, {
    sortBy: "PRIORITY",
    direction: descending ? "DESC" : "ASC",
  });
  return <p>{list.data?.items[0]?.reference ?? "Loading orders"}</p>;
}

it.each(["user", "estate"])(
  "keeps rows during a sort reload without carrying them into another %s",
  async (scope) => {
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        items: [{ id: "old", reference: "OAK-W0001" }],
        nextCursor: null,
      },
      response: new Response(),
    } as never);
    const view = renderWithProviders(
      <SortPreview descending={false} estateId="oak" />
    );
    await screen.findByText("OAK-W0001");
    vi.mocked(api.GET).mockReturnValue(new Promise(() => undefined));
    view.rerender(<SortPreview descending estateId="oak" />);
    screen.getByText("OAK-W0001");
    if (scope === "user") {
      state.userId = "different-user";
    }
    view.rerender(
      <SortPreview
        descending
        estateId={scope === "estate" ? "another-estate" : "oak"}
      />
    );
    expect(screen.queryByText("OAK-W0001")).toBeNull();
  }
);
beforeEach(() => {
  state.userId = "manager";
  state.canView = true;
  state.canCreate = true;
  vi.mocked(api.GET)
    .mockReset()
    .mockResolvedValue({
      data: { items: [], nextCursor: null },
      response: new Response(),
    } as never);
  vi.mocked(api.POST).mockReset();
});
it("does not fetch work orders without the estate capability", async () => {
  state.canView = false;
  renderWithProviders(<Orders />);
  await Promise.resolve();
  expect(api.GET).not.toHaveBeenCalled();
});
it("uses user-scoped caches and cancellation signals", async () => {
  const view = renderWithProviders(<Orders />);
  await waitFor(() => expect(api.GET).toHaveBeenCalled());
  const options = vi.mocked(api.GET).mock.calls[0][1] as
    | { signal: AbortSignal }
    | undefined;
  expect(options?.signal).toBeInstanceOf(AbortSignal);
  expect(
    view.queryClient
      .getQueryCache()
      .getAll()
      .every((query) => query.queryKey[0] === "manager")
  ).toBe(true);
});
it("refreshes access on an authorization failure and reports the query as failed", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Membership changed" },
    response: new Response(null, { status: 403 }),
  } as never);
  const view = renderWithProviders(<Orders />);
  view.queryClient.setQueryData(["manager", "app-access"], {});
  await screen.findByText("Unavailable");
  expect(
    view.queryClient.getQueryState(["manager", "app-access"])?.isInvalidated
  ).toBe(true);
});
it("does not automatically retry an ambiguous creation failure", async () => {
  vi.mocked(api.POST).mockRejectedValue(new Error("Network interrupted"));
  renderWithProviders(<Orders />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Save failed");
  expect(api.POST).toHaveBeenCalledTimes(1);
});
it("seeds the saved detail and refreshes only work-order lists", async () => {
  const saved = { id: "saved", reference: "OAK-W0001" };
  vi.mocked(api.POST).mockResolvedValue({
    data: saved,
    response: new Response(null, { status: 201 }),
  } as never);
  const view = renderWithProviders(<Orders />);
  view.queryClient.setQueryData(["manager", "estate-reports", "oak", "list"], {
    items: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved");
  expect(
    view.queryClient.getQueryData([
      "manager",
      "work-orders",
      "oak",
      "detail",
      "saved",
    ])
  ).toEqual(saved);
  expect(
    view.queryClient.getQueryState(["manager", "estate-reports", "oak", "list"])
      ?.isInvalidated
  ).toBe(false);
});
