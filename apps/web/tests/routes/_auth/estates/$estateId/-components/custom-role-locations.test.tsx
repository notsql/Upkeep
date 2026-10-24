import { fireEvent } from "@testing-library/react";
import { unassignedAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";

const DEACTIVATE = /deactivate/i;

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "member" }, loading: false }),
}));

const estate = {
  id: "estate",
  name: "Maple",
  code: "MAPLE",
  address: "Road",
  postalCode: "123456",
  owned: false,
  createdAt: "2026-10-24T00:00:00Z",
  updatedAt: "2026-10-24T00:00:00Z",
};
const block = {
  id: "block",
  type: "BLOCK",
  name: "Block A",
  createdAt: estate.createdAt,
  updatedAt: estate.updatedAt,
};

function serve({
  create = false,
  edit = false,
  details = false,
  inactive = false,
} = {}) {
  vi.mocked(api.GET).mockImplementation((path) => {
    let data: unknown = [block];
    if (path === "/access/context") {
      data = {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [
          {
            estateId: "estate",
            estateName: "Maple",
            role: "CUSTOM",
            canViewManagement: true,
            canManageEstate: details,
            canCreateLocations: create && !inactive,
            canCreateFloors: create && !inactive,
            canEditLocations: edit && !inactive,
          },
        ],
      };
    }
    if (path === "/estates/{id}") {
      data = { ...estate, deactivatedAt: inactive ? estate.createdAt : null };
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("lets a location creator add a block and bulk floors without estate-detail editing", async () => {
  serve({ create: true });
  renderWithProviders(<LocationsSection estateId="estate" />);
  screen.getByRole("searchbox", { name: "Search locations" });
  await screen.findByRole("button", { name: "Add block" });
  fireEvent.click(
    await screen.findByRole("button", { name: "Actions for Block A" })
  );
  await screen.findByRole("menuitem", { name: "Add levels to Block A" });
  expect(screen.queryByRole("menuitem", { name: "Edit Block A" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: DEACTIVATE })).toBeNull();
});

it("lets a location editor rename and move locations without creation or deactivation controls", async () => {
  serve({ edit: true });
  renderWithProviders(<LocationsSection estateId="estate" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Actions for Block A" })
  );
  await screen.findByRole("menuitem", { name: "Edit Block A" });
  expect(screen.queryByRole("button", { name: "Add block" })).toBeNull();
  expect(
    screen.queryByRole("menuitem", { name: "Add levels to Block A" })
  ).toBeNull();
  expect(screen.queryByRole("menuitem", { name: DEACTIVATE })).toBeNull();
});

it("does not treat estate-detail editing as permission to create locations", async () => {
  serve({ details: true });
  const { queryClient } = renderWithProviders(
    <LocationsSection estateId="estate" />
  );
  await waitFor(() =>
    expect(queryClient.getQueryData(["member", "app-access"])).toBeDefined()
  );
  expect(screen.queryByRole("button", { name: "Add block" })).toBeNull();
  expect(api.POST).not.toHaveBeenCalled();
});

it("removes an open location form when creation permission is revoked", async () => {
  serve({ create: true });
  const { queryClient } = renderWithProviders(
    <LocationsSection estateId="estate" />
  );
  fireEvent.click(await screen.findByRole("button", { name: "Add block" }));
  await screen.findByRole("dialog", { name: "Add block" });
  serve();
  await queryClient.invalidateQueries({ queryKey: ["member", "app-access"] });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Add block" })).toBeNull()
  );
  expect(api.POST).not.toHaveBeenCalled();
});
