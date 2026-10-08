import { fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_auth/admin/users";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "../../../../test-utils";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { GET: get, PUT: put } }));
const Page = Route.options.component as React.ComponentType;
beforeEach(() => {
  put.mockReset();
  get.mockReset();
  get.mockImplementation((path: string) => {
    if (path.endsWith("/all")) {
      return Promise.resolve({ data: [{ id: "org_1", name: "Acme" }] });
    }
    if (path.endsWith("/roles")) {
      return Promise.resolve({
        data: [
          { slug: "admin", name: "Admin" },
          { slug: "viewer", name: "Viewer" },
        ],
      });
    }
    return Promise.resolve({
      data: [
        {
          membershipId: "om_1",
          userId: "usr_1",
          name: "Casey Doe",
          email: "casey@example.com",
          joined: "2026-01-01T00:00:00Z",
          roleSlugs: ["viewer"],
        },
      ],
    });
  });
});
it("loads organization members and saves their role through the API", async () => {
  put.mockResolvedValue({ data: {} });
  renderWithProviders(<Page />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Estate" }),
    "Acme"
  );
  const role = await screen.findByRole("combobox", {
    name: "Role for Casey Doe",
  });
  await chooseOption(role, "Admin");
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith("/api/admin/users/{membershipId}/role", {
      params: { path: { membershipId: "om_1" } },
      body: { roleSlugs: ["admin"] },
    })
  );
});
it("shows a failed load without displaying mock users", async () => {
  get.mockResolvedValue({ error: {} });
  renderWithProviders(<Page />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to load organizations"
  );
  expect(screen.queryByText("Alex Morgan")).toBeNull();
});
it("reports a failed save and keeps the saved role", async () => {
  put.mockResolvedValue({ error: {} });
  renderWithProviders(<Page />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Estate" }),
    "Acme"
  );
  const role = await screen.findByRole("combobox", {
    name: "Role for Casey Doe",
  });
  await chooseOption(role, "Admin");
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to update role"
  );
  expect(role.textContent).toContain("Viewer");
  expect(role.textContent).not.toContain("Admin");
});
it("opens a member's estate access", async () => {
  renderWithProviders(<Page />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Estate" }),
    "Acme"
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Manage estates for Casey Doe" })
  );
  screen.getByRole("heading", { name: "Estate access for Casey Doe" });
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith("/api/admin/users/{userId}/estates", {
      params: { path: { userId: "usr_1" } },
    })
  );
});
