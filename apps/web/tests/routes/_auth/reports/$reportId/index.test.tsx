import { act } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_auth/reports/$reportId";

const { get, auth, listeners } = vi.hoisted(() => ({
  get: vi.fn(),
  auth: { user: { id: "resident-a" }, role: "user", loading: false },
  listeners: new Set<() => void>(),
}));
const INTERNAL_NOTE = /internal note/i;
const REPORT_NOT_FOUND = /report.*not found|report.*unavailable/i;
vi.mock("@/lib/api", () => ({ api: { GET: get } }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useParams: () => ({ reportId: "00000000-0000-0000-0000-000000000010" }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuth: () => ({
      ...auth,
      user: useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        () => auth.user
      ),
    }),
  };
});

const Page = Route.options.component as React.ComponentType;
const reportId = "00000000-0000-0000-0000-000000000010";
const imageId = "00000000-0000-0000-0000-000000000011";
const detail = {
  id: reportId,
  title: "Lift lobby leak",
  description: "<script>alert('x')</script> Leaking pipe",
  estateName: "Maple Estate",
  location: {
    id: "00000000-0000-0000-0000-000000000003",
    label: "Block A, Level 2",
  },
  status: "SUBMITTED",
  createdAt: "2026-10-12T00:00:00Z",
  updatedAt: "2026-10-12T00:00:00Z",
  images: [{ id: imageId, contentType: "image/png" }],
};

beforeEach(() => {
  auth.user = { id: "resident-a" };
  get.mockReset();
  get.mockImplementation((path: string) => {
    if (path.endsWith("/images/{imageId}")) {
      return Promise.resolve({
        data: new Blob(["image bytes"], { type: "image/png" }),
      });
    }
    return Promise.resolve({ data: detail });
  });
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:resident-image");
      static revokeObjectURL = vi.fn();
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

it("displays the saved title alongside the original description and estate", async () => {
  renderWithProviders(<Page />);
  await screen.findByText(detail.title);
  screen.getByText("Maple Estate");
  screen.getByText(detail.description, { exact: false });
});

it("labels report metadata and gives the complete description and images their own sections", async () => {
  const description = `First line\n${"Full report description. ".repeat(100)}\n${"x".repeat(200)}`;
  get.mockImplementation((path: string) =>
    Promise.resolve({
      data: path.endsWith("/images/{imageId}")
        ? new Blob(["image bytes"], { type: "image/png" })
        : { ...detail, description },
    })
  );
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { name: detail.title, level: 2 });
  for (const label of [
    "Estate name:",
    "Location:",
    "Status:",
    "Submission time:",
  ]) {
    screen.getByText(label);
  }
  const descriptionSection = screen.getByRole("region", {
    name: "Description",
  });
  expect(
    within(descriptionSection).getByText(description, {
      normalizer: (text) => text,
    }).textContent
  ).toBe(description);
  const images = screen.getByRole("region", { name: "Images" });
  await within(images).findByRole("img", { name: "Submitted fault" });
});

it("shows every image and explains when no images were submitted", async () => {
  get.mockResolvedValue({ data: { ...detail, images: [] } });
  renderWithProviders(<Page />);
  const images = await screen.findByRole("region", { name: "Images" });
  within(images).getByText("No images submitted.");
  expect(within(images).queryByRole("img")).toBeNull();
});

it("shows all submitted images and keeps image failures visible", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation(
    (path: string, options: { params: { path: { imageId?: string } } }) => {
      if (!path.endsWith("/images/{imageId}")) {
        return Promise.resolve({
          data: {
            ...detail,
            images: [
              { id: imageId },
              { id: "second-image" },
              { id: "failed-image" },
            ],
          },
        });
      }
      if (options.params.path.imageId === "failed-image") {
        return Promise.resolve({ error: { message: "Unavailable" } });
      }
      return original?.(path);
    }
  );
  renderWithProviders(<Page />);
  const images = await screen.findByRole("region", { name: "Images" });
  await waitFor(() =>
    expect(
      within(images).getAllByRole("img", { name: "Submitted fault" })
    ).toHaveLength(2)
  );
  expect((await within(images).findByRole("alert")).textContent).toBe(
    "Unable to load an image."
  );
});

it("shows the resident's report text, location and initial status as text", async () => {
  renderWithProviders(<Page />);

  const description = await screen.findByText(
    "<script>alert('x')</script> Leaking pipe"
  );
  screen.getByText("Block A, Level 2");
  screen.getByText("SUBMITTED");
  expect(description.querySelector("script")).toBeNull();
  expect(screen.queryByText(INTERNAL_NOTE)).toBeNull();
});

it("loads private image bytes through the authenticated API client", async () => {
  renderWithProviders(<Page />);
  await screen.findByRole("img");

  expect(get).toHaveBeenCalledWith(
    "/resident/reports/{reportId}/images/{imageId}",
    expect.objectContaining({
      params: { path: { reportId, imageId } },
    })
  );
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "blob:resident-image"
  );
});

it("shows an inaccessible or missing report as unavailable", async () => {
  get.mockResolvedValue({
    error: { message: "Not found" },
    response: new Response(null, { status: 404 }),
  });
  renderWithProviders(<Page />);
  await screen.findByText(REPORT_NOT_FOUND);
  expect(screen.queryByText("Leaking pipe")).toBeNull();
});

it("removes the previous user's image and revokes its blob URL on an account change", async () => {
  const original = get.getMockImplementation();
  get.mockImplementation((path: string) =>
    auth.user.id === "resident-a"
      ? original?.(path)
      : Promise.resolve({
          error: { message: "Not found" },
          response: new Response(null, { status: 404 }),
        })
  );
  renderWithProviders(<Page />);
  await screen.findByRole("img");
  act(() => {
    auth.user = { id: "resident-b" };
    for (const listener of listeners) {
      listener();
    }
  });
  await screen.findByText(REPORT_NOT_FOUND);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByText(detail.description)).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:resident-image");
});
