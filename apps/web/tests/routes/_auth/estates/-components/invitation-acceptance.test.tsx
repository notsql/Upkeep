import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { InvitationAcceptance } from "@/routes/_auth/estates/-components/invitation-acceptance";

vi.mock("@/lib/api", () => ({ api: { POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "recipient" }, loading: false }),
}));
beforeEach(() => vi.resetAllMocks());
it("activates accepted invitations and refreshes the estate list", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    data: { estateIds: ["estate"] },
    response: new Response(),
  } as never);
  const { queryClient } = renderWithProviders(<InvitationAcceptance />);
  queryClient.setQueryData(["estates", "recipient", "list", "ACTIVE"], []);
  queryClient.setQueryData(["recipient", "council-invitations"], []);
  expect((await screen.findByRole("status")).textContent).toContain(
    "Estate access updated"
  );
  expect(api.POST).toHaveBeenCalledWith("/council-invitations/accept");
  await waitFor(() =>
    expect(
      queryClient.getQueryState(["estates", "recipient", "list", "ACTIVE"])
        ?.isInvalidated
    ).toBe(true)
  );
  await waitFor(() =>
    expect(
      queryClient.getQueryState(["recipient", "council-invitations"])
        ?.isInvalidated
    ).toBe(true)
  );
});
it("offers a retry when invitation verification fails", async () => {
  vi.mocked(api.POST).mockResolvedValueOnce({
    error: { message: "Unable to verify invitations." },
    response: new Response(null, { status: 502 }),
  });
  renderWithProviders(<InvitationAcceptance />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to verify invitations."
  );
  vi.mocked(api.POST).mockResolvedValue({
    data: { estateIds: [] },
    response: new Response(),
  } as never);
  fireEvent.click(screen.getByRole("button", { name: "Retry invitations" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
