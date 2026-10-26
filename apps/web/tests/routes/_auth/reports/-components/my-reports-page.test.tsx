import { act, fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { MyReportsPage as Page } from "@/routes/_auth/reports/-components/my-reports-page";

const { get, auth, listeners } = vi.hoisted(() => ({
  get: vi.fn(),
  auth: { user: { id: "resident-a" }, role: "user", loading: false },
  listeners: new Set<() => void>(),
}));
const LEAKING_PIPE = /Leaking pipe/i;
const NO_REPORTS = /no reports/i;
const REPORT_A_FAULT = /Report a fault/i;
const NEXT = /Next/i;
const RETRY = /Retry/i;
vi.mock("@/lib/api", () => ({ api: { GET: get } }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
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

const report = {
  id: "00000000-0000-0000-0000-000000000010",
  title: "Leaking pipe",
  description: "Leaking pipe",
  estateName: "Maple Estate",
  location: {
    id: "00000000-0000-0000-0000-000000000003",
    label: "Block A, Level 2",
  },
  status: "SUBMITTED",
  createdAt: "2026-10-12T00:00:00Z",
  updatedAt: "2026-10-12T00:00:00Z",
};

beforeEach(() => {
  get.mockReset();
  auth.user = { id: "resident-a" };
});

it("labels each report's estate, location, status and submission time", async () => {
  get.mockResolvedValue({ data: { items: [report], nextCursor: null } });
  renderWithProviders(<Page />);
  await screen.findByRole("link", { name: LEAKING_PIPE });
  for (const label of [
    "Estate name:",
    "Location:",
    "Status:",
    "Submission time:",
  ]) {
    screen.getByText(label);
  }
  expect(
    screen
      .getByText(new Date(report.createdAt).toLocaleString())
      .getAttribute("dateTime")
  ).toBe(report.createdAt);
});

it("shows own report history with an ordinary WorkOS role even after assignment deletion", async () => {
  get.mockResolvedValue({ data: { items: [report], nextCursor: null } });
  renderWithProviders(<Page />);

  await screen.findByText("Leaking pipe");
  screen.getByText("Maple Estate");
  screen.getByText("Block A, Level 2");
  screen.getByText("SUBMITTED");
  expect(
    screen.getByRole("link", { name: LEAKING_PIPE }).getAttribute("href")
  ).toContain(report.id);
  expect(get).toHaveBeenCalledWith("/resident/reports", expect.anything());
});

it("shows an empty history and offers a new report", async () => {
  get.mockResolvedValue({ data: { items: [], nextCursor: null } });
  renderWithProviders(<Page />);

  await screen.findByText(NO_REPORTS);
  expect(
    screen.getByRole("link", { name: REPORT_A_FAULT }).getAttribute("href")
  ).toBe("/reports/new");
});

it("loads the next page only when the resident requests it", async () => {
  get.mockImplementation(
    (_path: string, options: { params?: { query?: { cursor?: string } } }) =>
      Promise.resolve({
        data: options.params?.query?.cursor
          ? {
              items: [
                {
                  ...report,
                  id: "older",
                  title: "Older fault",
                  description: "Older fault",
                },
              ],
              nextCursor: null,
            }
          : { items: [report], nextCursor: "next-page" },
      })
  );
  renderWithProviders(<Page />);
  await screen.findByText("Leaking pipe");
  expect(screen.queryByText("Older fault")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: NEXT }));
  await screen.findByText("Older fault");
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      "/resident/reports",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({ cursor: "next-page" }),
        }),
      })
    )
  );
});

it("uses the saved title rather than the description as the history link", async () => {
  get.mockResolvedValue({
    data: {
      items: [
        {
          ...report,
          title: "Lift lobby leak",
          description: "Water pooling near the lift",
        },
      ],
      nextCursor: null,
    },
  });
  renderWithProviders(<Page />);
  const link = await screen.findByRole("link", { name: "Lift lobby leak" });
  expect(link.getAttribute("href")).toContain(report.id);
  expect(
    screen.queryByRole("link", { name: "Water pooling near the lift" })
  ).toBeNull();
});

it("shows a retryable error without displaying stale report text", async () => {
  get.mockResolvedValue({ error: { message: "Unavailable" } });
  renderWithProviders(<Page />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Leaking pipe")).toBeNull();
  screen.getByRole("button", { name: RETRY });
});

it("does not show the previous resident's cached report after an account change", async () => {
  get.mockImplementation(() =>
    Promise.resolve({
      data:
        auth.user.id === "resident-a"
          ? { items: [report], nextCursor: null }
          : { items: [], nextCursor: null },
    })
  );
  renderWithProviders(<Page />);
  await screen.findByText("Leaking pipe");

  act(() => {
    auth.user = { id: "resident-b" };
    for (const listener of listeners) {
      listener();
    }
  });
  await screen.findByText(NO_REPORTS);
  expect(screen.queryByText("Leaking pipe")).toBeNull();
});

it("loads an estate-scoped history and preselects that estate for a new report", async () => {
  get.mockResolvedValue({ data: { items: [], nextCursor: null } });
  renderWithProviders(<Page estateId="maple" estateName="Maple Estate" />);
  await screen.findByText(NO_REPORTS);
  screen.getByText("Maple Estate");
  expect(get).toHaveBeenCalledWith(
    "/resident/reports",
    expect.objectContaining({ params: { query: { estateId: "maple" } } })
  );
  expect(
    screen.getByRole("link", { name: REPORT_A_FAULT }).getAttribute("href")
  ).toBe("/reports/new?estateId=maple");
});

it("starts from the first page when the selected estate changes", async () => {
  get.mockImplementation(
    (
      _path: string,
      options: { params: { query: { estateId?: string; cursor?: string } } }
    ) => {
      const { estateId, cursor } = options.params.query;
      const mapleTitle = cursor ? "Older Maple report" : "Maple report";
      return Promise.resolve({
        data: {
          items: [
            {
              ...report,
              title: estateId === "oak" ? "Oak report" : mapleTitle,
            },
          ],
          nextCursor: estateId === "oak" || cursor ? null : "maple-next",
        },
      });
    }
  );
  const view = renderWithProviders(<Page estateId="maple" />);
  await screen.findByRole("link", { name: "Maple report" });
  fireEvent.click(screen.getByRole("button", { name: NEXT }));
  await screen.findByRole("link", { name: "Older Maple report" });
  view.rerender(<Page estateId="oak" />);
  await screen.findByRole("link", { name: "Oak report" });
  expect(get).toHaveBeenCalledWith(
    "/resident/reports",
    expect.objectContaining({ params: { query: { estateId: "oak" } } })
  );
  expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
});

it("preserves the selected estate when opening a report", async () => {
  get.mockResolvedValue({ data: { items: [report], nextCursor: null } });
  renderWithProviders(<Page estateId="maple" estateName="Maple Estate" />);
  const link = await screen.findByRole("link", { name: LEAKING_PIPE });
  expect(link.getAttribute("href")).toBe(
    `/reports/${report.id}?estateId=maple`
  );
});
