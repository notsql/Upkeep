import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { PendingInvitations } from "@/routes/_auth/estates/-components/pending-invitations";

const REVIEWER_NAME = /Fault reviewer/;
const UPDATED_NAME = /Estate reviewer/;

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { GET: apiGet, POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "recipient" }, loading: false }),
}));

const offer = {
  id: "offer",
  estateId: "estate",
  estateName: "Maple Estate",
  expiresAt: "2026-12-01T00:00:00Z",
  role: "CUSTOM",
  customRoleId: "reader-role",
  customRoleName: "Fault reviewer",
  customRoleVersion: 3,
  customPermissions: [
    {
      code: "VIEW_FAULT_REPORTS",
      label: "View fault reports",
      description: "Read reports and their private images.",
      requires: [],
    },
  ],
};
const acceptLabel = "Accept invitation to Maple Estate";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.GET).mockResolvedValue({
    data: [offer],
    response: new Response(),
  } as never);
  vi.mocked(api.POST).mockResolvedValue({
    data: { estateIds: ["estate"] },
    response: new Response(),
  } as never);
});

it("shows the custom role name without permission details before acceptance", async () => {
  renderWithProviders(<PendingInvitations />);
  await screen.findByRole("button", { name: acceptLabel });
  screen.getByText(REVIEWER_NAME);
  expect(
    screen.queryByRole("list", { name: "Offered permissions" })
  ).toBeNull();
  expect(screen.queryByText(offer.customPermissions[0].label)).toBeNull();
  expect(screen.queryByText(offer.customPermissions[0].description)).toBeNull();
  expect(api.POST).not.toHaveBeenCalled();
  expect(apiGet.mock.calls.map(([path]) => path)).toEqual([
    "/council-invitations",
  ]);
});

it("accepts with the displayed role version without a client-provided role override", async () => {
  renderWithProviders(<PendingInvitations />);
  fireEvent.click(await screen.findByRole("button", { name: acceptLabel }));
  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/council-invitations/{invitationId}/accept",
      {
        params: { path: { invitationId: "offer" } },
        body: { expectedRoleVersion: 3 },
      }
    )
  );
});

it("refreshes a stale preview after 409 and waits for another explicit confirmation", async () => {
  const updated = {
    ...offer,
    customRoleVersion: 4,
    customRoleName: "Estate reviewer",
    customPermissions: [
      {
        code: "VIEW_ESTATE",
        label: "View estate",
        description: "View the estate dashboard.",
        requires: [],
      },
    ],
  };
  vi.mocked(api.POST).mockImplementation(() => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [updated],
      response: new Response(),
    } as never);
    return Promise.resolve({
      error: { message: "Role changed. Review the updated permissions." },
      response: new Response(null, { status: 409 }),
    });
  });
  renderWithProviders(<PendingInvitations />);
  fireEvent.click(await screen.findByRole("button", { name: acceptLabel }));
  await screen.findByRole("alert");
  await screen.findByText(UPDATED_NAME);
  expect(screen.queryByText("View estate")).toBeNull();
  expect(screen.queryByText("View the estate dashboard.")).toBeNull();
  expect(screen.queryByText("View fault reports")).toBeNull();
  expect(api.POST).toHaveBeenCalledTimes(1);
  vi.mocked(api.POST).mockResolvedValue({
    data: { estateIds: ["estate"] },
    response: new Response(),
  } as never);
  fireEvent.click(screen.getByRole("button", { name: acceptLabel }));
  await waitFor(() =>
    expect(api.POST).toHaveBeenLastCalledWith(
      "/council-invitations/{invitationId}/accept",
      {
        params: { path: { invitationId: "offer" } },
        body: { expectedRoleVersion: 4 },
      }
    )
  );
});
