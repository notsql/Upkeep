import { fireEvent } from "@testing-library/react";
import { expectLeadingIcon } from "@tests/section-action";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/assessments";
import { formatAssessmentNotes, formatDate } from "@/lib/format";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section";

vi.mock(
  "@/components/forms/date-picker",
  () => import("@tests/date-picker-stubs")
);
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: linkParams,
    className,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => (
    <a
      className={className}
      href={to
        .replace("$estateId", linkParams?.estateId ?? "")
        .replace("$assetId", linkParams?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

const PATH = "/estates/{estateId}/assets/{assetId}/assessments";
const params = { path: { estateId: "estate-id", assetId: "asset-id" } };

function assessment(
  id: string,
  condition: Assessment["condition"],
  assessedOn: string,
  notes: string,
  recordedByName?: string
): Assessment {
  return {
    id,
    assetId: "asset-id",
    condition,
    assessedOn,
    notes,
    recordedByUserId: "user_1",
    recordedByName,
    recordedAt: "2026-09-28T02:00:00Z",
  };
}

let history: Assessment[];

function serve() {
  vi.mocked(api.GET).mockImplementation((() =>
    Promise.resolve({ data: history, response: new Response() })) as never);
}

function renderSection(canRecord = true) {
  renderWithProviders(
    <AssetConditionSection
      assetId="asset-id"
      canRecord={canRecord}
      estateId="estate-id"
    />
  );
}

const HISTORY_LINK = /^View history/u;

describe("AssetConditionSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The API returns the current condition first.
    history = [
      assessment("a2", "FAULTY", "2026-09-20", "Motor seized.", "Casey Doe"),
      assessment("a1", "GOOD", "2026-03-01", "Annual service."),
    ];
    serve();
  });

  it("shows the upcoming work inside the Condition card, under a separator", () => {
    renderWithProviders(
      <AssetConditionSection
        assetId="asset-id"
        canRecord
        estateId="estate-id"
        upcoming={<h3>Upcoming</h3>}
      />
    );
    const card = screen.getByRole("region", { name: "Condition" });
    within(card).getByRole("heading", { level: 3, name: "Upcoming" });
    within(card).getByRole("separator");
  });

  it("shows no separator without upcoming work", async () => {
    renderSection();
    await screen.findByRole("status", { name: "Current condition" });
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("shows the latest assessment as the current condition", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    expect(current.textContent).toContain("Faulty");
    expect(current.textContent).toContain(
      `Assessed ${formatDate("2026-09-20")}`
    );
    expect(current.textContent).not.toContain("2026-09-20");
    expect(api.GET).toHaveBeenCalledWith(PATH, { params });
  });

  it("shows the latest note and who recorded it with the current condition", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    within(current).getByText("Motor seized.");
    expect(current.textContent).toContain("Casey Doe");
  });

  it("headlines the condition in its tone, with date and recorder on one meta line", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    const headline = within(current).getByText("Faulty");
    expect(headline.closest("[data-tone]")?.getAttribute("data-tone")).toBe(
      "faulty"
    );
    within(current).getByText(
      `Assessed ${formatDate("2026-09-20")} · Casey Doe`
    );
    expect(current.querySelector("[data-slot=badge]")).toBeNull();
  });

  it("leads Record assessment with an icon", async () => {
    renderSection();
    expectLeadingIcon(
      await screen.findByRole("button", { name: "Record condition check" })
    );
  });

  it("links to the full history page instead of a disclosure", async () => {
    renderSection();
    const link = await screen.findByRole("link", { name: "View history (2)" });
    expect(link.getAttribute("href")).toBe(
      "/estates/estate-id/assets/asset-id/condition"
    );
    expect(screen.queryByRole("button", { name: HISTORY_LINK })).toBeNull();
    expect(
      screen.queryByRole("list", { name: "Condition history" })
    ).toBeNull();
    expect(screen.queryByText("Annual service.")).toBeNull();
  });

  it("links to no history when there is only the current assessment", async () => {
    history = [assessment("a1", "GOOD", "2026-03-01", "Annual service.")];
    renderSection();
    await screen.findByRole("status", { name: "Current condition" });
    expect(screen.queryByRole("link", { name: HISTORY_LINK })).toBeNull();
  });

  it("leaves filing an inspection to the page-level alert", async () => {
    renderSection();
    await screen.findByRole("status", { name: "Current condition" });
    expect(
      screen.queryByRole("link", { name: "File an inspection" })
    ).toBeNull();
    expect(screen.queryByText("This asset needs a closer look")).toBeNull();
  });

  it("says when an asset has never been assessed, and closes recording on a deactivated asset", async () => {
    history = [];
    renderSection(false);
    expect(
      (await screen.findByRole("status", { name: "Current condition" }))
        .textContent
    ).toContain("Not checked yet");
    expect(
      screen.queryByRole("button", { name: "Record condition check" })
    ).toBeNull();
  });

  it("records an assessment and makes it the current condition", async () => {
    vi.mocked(api.POST).mockImplementation((() => {
      history = [
        assessment(
          "a3",
          "NEEDS_ATTENTION",
          "2026-09-27",
          "Noisy bearing.",
          "Casey Doe"
        ),
        ...history,
      ];
      return Promise.resolve({ data: history[0], response: new Response() });
    }) as never);
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Record condition check" })
    );
    await chooseOption(
      screen.getByRole("combobox", { name: "Condition" }),
      "Needs attention"
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Date checked" }), {
      target: { value: "2026-09-27" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), {
      target: { value: "Noisy bearing." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Record condition check" })
    );

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(PATH, {
        params,
        body: {
          condition: "NEEDS_ATTENTION",
          assessedOn: "2026-09-27",
          notes: "Noisy bearing.",
        },
      })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Current condition" }).textContent
      ).toContain("Needs attention")
    );
    await screen.findByRole("link", { name: "View history (3)" });
  });
});

it("opens assessment in a dialog and cancels without recording", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [],
    response: new Response(),
  } as never);
  renderSection();
  fireEvent.click(
    screen.getByRole("button", { name: "Record condition check" })
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Record condition check",
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Notes" }), {
    target: { value: "Draft" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.POST).not.toHaveBeenCalled();
});

const MODEL = "system:anomaly-model";
const MODEL_NOTES =
  "11 consecutive abnormal samples in device readings from 2026-09-28T01:59:15.862Z to 2026-09-28T01:59:25.862Z. Median score 0.82, maximum 0.88.";
const PERSON_NOTES = "Checked at 2026-09-28T01:59:15Z, seal looks fine.";

describe("AssetConditionSection formatting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T02:02:00Z"));
    history = [
      {
        ...assessment("m1", "NEEDS_ATTENTION", "2026-09-28", MODEL_NOTES),
        recordedByUserId: MODEL,
      },
      {
        ...assessment("p1", "GOOD", "2026-03-01", PERSON_NOTES, "Casey Doe"),
        recordedAt: "2026-03-01T02:00:00Z",
      },
    ];
    serve();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows assessment dates as formatted dates", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    expect(current.textContent).toContain(
      `Assessed ${formatDate("2026-09-28")}`
    );
  });

  it("names unusual readings as the source of a model assessment", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    expect(current.textContent).toContain("Unusual readings");
  });

  it("formats model notes and keeps a person's notes verbatim", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    within(current).getByText(
      formatAssessmentNotes({ notes: MODEL_NOTES, recordedByUserId: MODEL })
    );
    expect(current.textContent).not.toContain("2026-09-28T01:59:15.862Z");
  });
});
