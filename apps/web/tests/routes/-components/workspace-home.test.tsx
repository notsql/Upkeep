import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { WorkspaceHome } from "@/routes/-components/workspace-home";

const { auth } = vi.hoisted(() => ({
  auth: { user: { id: "owner" } as { id: string } | null, loading: false },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string };
    search?: Record<string, string>;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={
        to.replace("$estateId", params?.estateId ?? "") +
        (search ? `?${new URLSearchParams(search)}` : "")
      }
      {...props}
    >
      {children}
    </a>
  ),
}));
const summary = {
  accessibleEstateCount: 3,
  activeEstateCount: 2,
  inactiveEstateCount: 1,
  activeOwnedEstateCount: 1,
  totalActiveAssets: 4,
  councilMemberCount: 7,
  conditionCounts: { good: 1, needsAttention: 1, faulty: 1, unassessed: 1 },
  affectedEstateCount: 1,
  estatesNeedingAttention: [
    {
      estateId: "e",
      estateName: "Maple Grove",
      estateCode: "MG-001",
      totalActiveAssets: 4,
      councilMemberCount: 7,
      needsAttentionCount: 1,
      faultyCount: 1,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: "owner" };
  auth.loading = false;
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data:
          path === "/dashboard/summary"
            ? summary
            : [{ id: "i", estateName: "Oak Estate" }],
        response: new Response(),
      }) as never
  );
});
it("shows actual scoped totals and attention links instead of another estate directory", async () => {
  renderWithProviders(<WorkspaceHome />);
  const assets = within(
    await screen.findByRole("region", { name: "Active assets" })
  );
  assets.getByText("4");
  within(screen.getByRole("region", { name: "Attention needed" })).getByText(
    "2"
  );
  within(screen.getByRole("region", { name: "Council members" })).getByText(
    "7"
  );
  expect(screen.queryByRole("region", { name: "Not assessed" })).toBeNull();
  screen.getByText("Asset and member summaries cover 1 active estate you own.");
  const faulty = screen.getByRole<HTMLAnchorElement>("link", {
    name: "Review faulty assets in Maple Grove",
  });
  expect(faulty.href).toContain("/estates/e/assets?");
  expect(faulty.href).toContain("condition=FAULTY");
  expect(faulty.href).toContain("status=ACTIVE");
  screen.getByRole("link", {
    name: "Review needs-attention assets in Maple Grove",
  });
  expect(screen.queryByRole("list", { name: "Your estates" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Create estate" })).toBeNull();
  expect(screen.queryByText("Oak Estate")).toBeNull();
  screen.getByText("1 invitation waiting.");
  expect(screen.queryByRole("link", { name: "Browse estates" })).toBeNull();
  screen.getByRole("link", { name: "Accessible estates" });
});
it("does not present unavailable asset summaries as zeros for a shared-only account", async () => {
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data:
          path === "/dashboard/summary"
            ? {
                ...summary,
                activeOwnedEstateCount: 0,
                totalActiveAssets: 0,
                conditionCounts: {
                  good: 0,
                  needsAttention: 0,
                  faulty: 0,
                  unassessed: 0,
                },
                affectedEstateCount: 0,
                estatesNeedingAttention: [],
              }
            : [],
        response: new Response(),
      }) as never
  );
  renderWithProviders(<WorkspaceHome />);
  within(
    await screen.findByRole("region", { name: "Active assets" })
  ).getByText("—");
  screen.getByText(
    "Asset and member summaries are available for active estates you own."
  );
  expect(
    screen.queryByRole("heading", { name: "Asset conditions" })
  ).toBeNull();
});
it("shows an error and retry without fabricated counts, independently of invitations", async () => {
  vi.mocked(api.GET).mockImplementation(async (path) =>
    path === "/dashboard/summary"
      ? ({
          error: { message: "Summary unavailable" },
          response: new Response(null, { status: 503 }),
        } as never)
      : ({ data: [{ id: "i" }], response: new Response() } as never)
  );
  renderWithProviders(<WorkspaceHome />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Summary unavailable"
  );
  expect(screen.queryByRole("region", { name: "Active assets" })).toBeNull();
  screen.getByText("1 invitation waiting.");
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data: path === "/dashboard/summary" ? summary : [],
        response: new Response(),
      }) as never
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry summary" }));
  await screen.findByRole("region", { name: "Active assets" });
});
it("retains summary data when invitations fail and isolates data on account switch", async () => {
  vi.mocked(api.GET).mockImplementation(async (path) =>
    path === "/council-invitations"
      ? ({
          error: { message: "Invitations unavailable" },
          response: new Response(null, { status: 503 }),
        } as never)
      : ({ data: summary, response: new Response() } as never)
  );
  const rendered = renderWithProviders(<WorkspaceHome />);
  await screen.findByRole("region", { name: "Active assets" });
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Invitations unavailable"
  );
  auth.user = { id: "different-user" };
  // Invitations use their own data shape, even after switching accounts.
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data:
          path === "/dashboard/summary"
            ? {
                ...summary,
                activeOwnedEstateCount: 0,
                accessibleEstateCount: 0,
                totalActiveAssets: 0,
                affectedEstateCount: 0,
                estatesNeedingAttention: [],
              }
            : [],
        response: new Response(),
      }) as never
  );
  rendered.rerender(<WorkspaceHome />);
  await waitFor(() => expect(screen.queryByText("Maple Grove")).toBeNull());
  within(
    await screen.findByRole("region", { name: "Accessible estates" })
  ).getByText("0");
});
it("does not request private summaries while the session is loading", () => {
  auth.loading = true;
  renderWithProviders(<WorkspaceHome />);
  expect(api.GET).not.toHaveBeenCalled();
});

it("shows the actual condition distribution and links attention to its estate section", async () => {
  renderWithProviders(<WorkspaceHome />);
  const distribution = await screen.findByRole("figure", {
    name: "Asset condition distribution",
  });
  for (const name of ["Good", "Needs attention", "Faulty", "Not assessed"]) {
    within(distribution).getByText(`${name}: 1 (25%)`);
  }
  const link = screen.getByRole<HTMLAnchorElement>("link", {
    name: "Attention needed",
  });
  expect(link.getAttribute("href")).toBe("#attention-estates");
  fireEvent.click(link);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Estates needing attention" })
  );
  const estate = screen.getByRole<HTMLAnchorElement>("link", {
    name: "View active assets in Maple Grove",
  });
  expect(estate.href).toContain("/estates/e/assets?status=ACTIVE");
});
it("distinguishes an empty condition distribution from healthy assets", async () => {
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data:
          path === "/dashboard/summary"
            ? {
                ...summary,
                totalActiveAssets: 0,
                conditionCounts: {
                  good: 0,
                  needsAttention: 0,
                  faulty: 0,
                  unassessed: 0,
                },
                affectedEstateCount: 0,
                estatesNeedingAttention: [],
              }
            : [],
        response: new Response(),
      }) as never
  );
  renderWithProviders(<WorkspaceHome />);
  await screen.findByText("No active assets to assess.");
  expect(
    screen.queryByRole("figure", { name: "Asset condition distribution" })
  ).toBeNull();
});
