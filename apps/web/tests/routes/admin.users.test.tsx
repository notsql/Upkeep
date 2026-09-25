import { fireEvent } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/admin.users";
import { renderWithProviders, screen, waitFor } from "../test-utils";

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
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Organization" }),
    { target: { value: "org_1" } }
  );
  const role = await screen.findByRole("combobox", {
    name: "Role for Casey Doe",
  });
  fireEvent.change(role, { target: { value: "admin" } });
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
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Organization" }),
    { target: { value: "org_1" } }
  );
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Role for Casey Doe" }),
    { target: { value: "admin" } }
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to update role"
  );
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Role for Casey Doe",
    }).value
  ).toBe("viewer");
});
