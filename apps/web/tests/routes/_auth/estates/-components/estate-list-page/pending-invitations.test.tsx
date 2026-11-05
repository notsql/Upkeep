import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { PendingInvitations } from "@/routes/_auth/estates/-components/estate-list-page/pending-invitations";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "recipient" }, loading: false }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      {
        id: "invite",
        estateId: "estate",
        estateName: "Maple Grove",
        expiresAt: "2026-12-01T00:00:00Z",
      },
    ],
    response: new Response(),
  } as never);
});
it("requires an explicit accept action and refreshes estate access", async () => {
  const { queryClient } = renderWithProviders(<PendingInvitations />);
  queryClient.setQueryData(["estates", "recipient", "list", "ACTIVE"], []);
  const accept = await screen.findByRole("button", {
    name: "Accept invitation to Maple Grove",
  });
  expect(api.POST).not.toHaveBeenCalled();
  vi.mocked(api.POST).mockResolvedValue({
    data: { estateIds: ["estate"] },
    response: new Response(),
  } as never);
  vi.mocked(api.GET).mockResolvedValue({
    data: [],
    response: new Response(),
  } as never);
  fireEvent.click(accept);
  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/council-invitations/{invitationId}/accept",
      { params: { path: { invitationId: "invite" } } }
    )
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Accept invitation to Maple Grove" })
    ).toBeNull()
  );
  expect(
    queryClient.getQueryState(["estates", "recipient", "list", "ACTIVE"])
      ?.isInvalidated
  ).toBe(true);
});
it("keeps failed invitations visible and reports why acceptance failed", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    error: { message: "This invitation is no longer available." },
    response: new Response(null, { status: 409 }),
  } as never);
  renderWithProviders(<PendingInvitations />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Accept invitation to Maple Grove",
    })
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "no longer available"
  );
  expect(
    screen.getByRole("button", { name: "Accept invitation to Maple Grove" })
  ).toBeTruthy();
});
it("shows each invitation as a compact banner row with an inline accept", async () => {
  renderWithProviders(<PendingInvitations />);
  const list = await screen.findByRole("list", {
    name: "Pending estate invitations",
  });
  const row = within(list).getByRole("listitem");
  expect(row.textContent).toContain("You're invited to Maple Grove");
  expect(
    within(row).getByRole("button", {
      name: "Accept invitation to Maple Grove",
    }).textContent
  ).toBe("Accept");
});
