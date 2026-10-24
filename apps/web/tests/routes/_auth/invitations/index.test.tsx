import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import type { ComponentType } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { Route } from "@/routes/_auth/invitations/index";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "recipient" }, loading: false }),
}));
vi.mock("@/routes/_auth/estates/-components/invitation-acceptance", () => ({
  InvitationAcceptance: () => null,
}));

const Page = Route.options.component as ComponentType;

beforeEach(() => {
  vi.resetAllMocks();
});

it("explains when there are no pending estate invitations", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [],
    response: new Response(),
  } as never);
  renderWithProviders(<Page />);

  await screen.findByRole("heading", { name: "No pending invitations" });
  screen.getByText("You have no estate invitations to review right now.");
});

it("does not claim there are no invitations while they are loading", async () => {
  vi.mocked(api.GET).mockReturnValue(new Promise(() => undefined));
  renderWithProviders(<Page />);

  await waitFor(() => expect(api.GET).toHaveBeenCalled());
  expect(
    screen.queryByRole("heading", { name: "No pending invitations" })
  ).toBeNull();
});

it("shows the retry action instead of an empty state when loading fails", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Estate access is temporarily unavailable." },
    response: new Response(null, { status: 503 }),
  } as never);
  renderWithProviders(<Page />);

  await screen.findByRole("alert");
  screen.getByRole("button", { name: "Retry pending invitations" });
  expect(
    screen.queryByRole("heading", { name: "No pending invitations" })
  ).toBeNull();
});

it("shows the invitation to accept instead of an empty state when one exists", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      {
        id: "invite",
        estateId: "estate",
        estateName: "Maple Grove",
        role: "MANAGER",
        expiresAt: "2026-12-01T00:00:00Z",
      },
    ],
    response: new Response(),
  } as never);
  renderWithProviders(<Page />);

  await screen.findByRole("button", {
    name: "Accept invitation to Maple Grove",
  });
  expect(
    screen.queryByRole("heading", { name: "No pending invitations" })
  ).toBeNull();
});
