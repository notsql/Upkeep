import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { useAssetWorkOrderCompletions } from "@/lib/work-orders";

const state = vi.hoisted(() => ({ allowed: true, userId: "owner" }));
vi.mock("@/lib/access", () => ({
  useAuthenticatedSession: () => ({ ready: true, userId: state.userId }),
  useAppAccess: () => ({
    data: { estates: [{ estateId: "oak", canViewAssets: state.allowed }] },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
function History() {
  const query = useAssetWorkOrderCompletions("oak", "pump");
  return <p>{query.data?.[0]?.reference ?? "No accessible completion"}</p>;
}
beforeEach(() => {
  state.allowed = true;
  state.userId = "owner";
  vi.mocked(api.GET)
    .mockReset()
    .mockResolvedValue({
      data: [{ reference: "OAK-W0001" }],
      response: new Response(),
    } as never);
});
it("removes cached completed work when asset permission is revoked", async () => {
  const view = renderWithProviders(<History />);
  await screen.findByText("OAK-W0001");
  state.allowed = false;
  view.rerender(<History />);
  expect(screen.queryByText("OAK-W0001")).toBeNull();
});
it("hides cached outcomes after an authorization error on refetch", async () => {
  const view = renderWithProviders(<History />);
  await screen.findByText("OAK-W0001");
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Access changed" },
    response: new Response(null, { status: 403 }),
  } as never);
  await view.queryClient.invalidateQueries({
    queryKey: ["owner", "asset-work-order-completions", "oak", "pump"],
  });
  await waitFor(() => expect(screen.queryByText("OAK-W0001")).toBeNull());
});
