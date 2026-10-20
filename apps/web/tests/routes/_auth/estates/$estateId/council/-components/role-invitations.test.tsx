import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.GET).mockImplementation((path) => {
    let data: unknown = {
      id: "estate",
      name: "Maple",
      owned: false,
      canInviteMembers: true,
      canManageInvitationPermissions: true,
    };
    if (path === "/estates/{estateId}/members") {
      data = [
        {
          userId: "manager",
          name: "Me",
          email: "me@example.com",
          role: "MANAGER",
          owner: false,
        },
        {
          userId: "other",
          name: "Other",
          email: "other@example.com",
          role: "COUNCIL",
          owner: false,
        },
      ];
    }
    if (path === "/estates/{estateId}/council-invitations") {
      data = [];
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
});

it("lets a non-owner Manager invite Crew with the selected stored role", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    data: { email: "crew@example.com", role: "CREW", status: "IN_APP" },
    response: new Response(null, { status: 201 }),
  } as never);
  renderWithProviders(<CouncilPage estateId="estate" />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
    target: { value: "crew@example.com" },
  });
  await chooseOption(
    screen.getByRole("combobox", { name: "Invitation role" }),
    "Crew"
  );
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/council-invitations",
      {
        params: { path: { estateId: "estate" } },
        body: { email: "crew@example.com", role: "CREW" },
      }
    )
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "No email was sent"
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
});

it("offers role management to another Manager while hiding self-removal and self-demotion", async () => {
  renderWithProviders(<CouncilPage estateId="estate" />);
  await screen.findByRole("combobox", { name: "Role for Other" });
  expect(screen.queryByRole("combobox", { name: "Role for Me" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Remove access for me@example.com" })
  ).toBeNull();
  screen.getByRole("button", { name: "Remove access for other@example.com" });
});
