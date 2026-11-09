import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/assessments";
import { formatAssessmentNotes, formatDate } from "@/lib/format";
import { AssetConditionHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/condition/-components/asset-condition-history-page";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

const viewer = vi.hoisted(() => ({ canViewAssets: true }));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    isPending: false,
    isError: false,
    data: {
      estates: [
        {
          estateId: "estate",
          role: "MEMBER",
          canViewAssets: viewer.canViewAssets,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: { id: "asset", name: "Water pump", reference: "MG-A0001" },
  }),
}));

const MODEL = "system:anomaly-model";
const MODEL_NOTES =
  "11 consecutive abnormal samples in device readings from 2026-09-28T01:59:15.862Z to 2026-09-28T01:59:25.862Z. Median score 0.82, maximum 0.88.";

function assessment(
  id: string,
  condition: Assessment["condition"],
  assessedOn: string,
  notes: string,
  recordedByUserId = "user_1",
  recordedByName?: string
): Assessment {
  return {
    id,
    assetId: "asset",
    condition,
    assessedOn,
    notes,
    recordedByUserId,
    recordedByName,
    recordedAt: `${assessedOn}T02:00:00Z`,
  };
}

let history: Assessment[];

function page() {
  renderWithProviders(
    <AssetConditionHistoryPage assetId="asset" estateId="estate" />
  );
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  viewer.canViewAssets = true;
  // The API returns the current condition first.
  history = [
    assessment("a3", "NEEDS_ATTENTION", "2026-09-28", MODEL_NOTES, MODEL),
    assessment("a2", "FAULTY", "2026-09-20", "Motor seized.", "u", "Casey Doe"),
    assessment("a1", "GOOD", "2026-03-01", "Annual service."),
  ];
  vi.mocked(api.GET).mockImplementation((() =>
    Promise.resolve({ data: history, response: new Response() })) as never);
});

describe("AssetConditionHistoryPage", () => {
  it("titles the page and leads back to the asset in the breadcrumbs", async () => {
    page();
    screen.getByRole("heading", { level: 1, name: "Condition history" });
    const crumbs = within(
      screen.getByRole("navigation", { name: "Breadcrumbs" })
    );
    expect(
      crumbs
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Assets", "/estates/estate/assets"],
      ["Water pump", "/estates/estate/assets/asset"],
    ]);
    await screen.findByRole("list", { name: "Condition history" });
  });

  it("lists every assessment newest first with its badge, date, source and note", async () => {
    page();
    const list = await screen.findByRole("list", { name: "Condition history" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const [latest, middle, oldest] = items as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    within(latest).getByText("Needs attention");
    within(latest).getByText(formatDate("2026-09-28"));
    within(latest).getByText("Unusual readings");
    within(latest).getByText(
      formatAssessmentNotes({ notes: MODEL_NOTES, recordedByUserId: MODEL })
    );
    within(middle).getByText("Faulty");
    within(middle).getByText("Casey Doe");
    within(middle).getByText("Motor seized.");
    within(oldest).getByText("Good");
    within(oldest).getByText("Unknown user");
    expect(list.textContent).not.toContain("2026-03-01");
  });

  it("marks the newest entry as the current condition", async () => {
    page();
    const list = await screen.findByRole("list", { name: "Condition history" });
    const [latest, middle] = within(list).getAllByRole("listitem") as [
      HTMLElement,
      HTMLElement,
    ];
    expect(within(latest).getByText("Current").dataset.variant).toBe("info");
    expect(within(middle).queryByText("Current")).toBeNull();
  });

  it("renders the history as an ordered timeline with decorative icons", async () => {
    page();
    const list = await screen.findByRole("list", { name: "Condition history" });
    expect(list.tagName).toBe("OL");
    const [latest, middle] = within(list).getAllByRole("listitem") as [
      HTMLElement,
      HTMLElement,
    ];
    expect(latest.getAttribute("data-tone")).toBe("needs-attention");
    expect(middle.getAttribute("data-tone")).toBe("faulty");
    const icons = list.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("shows the timeline on the page, not inside a card", async () => {
    page();
    const list = await screen.findByRole("list", { name: "Condition history" });
    expect(list.closest("[data-slot='card']")).toBeNull();
  });

  it("heads each month once", async () => {
    page();
    const list = await screen.findByRole("list", { name: "Condition history" });
    const months = within(list).getAllByRole("heading", { level: 2 });
    expect(months.map((month) => month.textContent)).toEqual([
      "September 2026",
      "March 2026",
    ]);
  });

  it("says when the asset has never been assessed", async () => {
    history = [];
    page();
    await screen.findByText("Not checked yet");
    expect(
      screen.queryByRole("list", { name: "Condition history" })
    ).toBeNull();
  });

  it("refuses a viewer who cannot see assets, without requesting", () => {
    viewer.canViewAssets = false;
    page();
    screen.getByText("Asset access is unavailable.");
    expect(api.GET).not.toHaveBeenCalled();
  });
});
