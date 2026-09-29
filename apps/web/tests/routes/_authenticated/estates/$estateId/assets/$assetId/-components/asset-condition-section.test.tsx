import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/assessments";
import { AssetConditionSection } from "@/routes/_authenticated/estates/$estateId/assets/$assetId/-components/asset-condition-section";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../../../../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

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

  it("shows the latest assessment as the current condition", async () => {
    renderSection();
    const current = await screen.findByRole("status", {
      name: "Current condition",
    });
    expect(current.textContent).toContain("Faulty");
    expect(current.textContent).toContain("2026-09-20");
    expect(api.GET).toHaveBeenCalledWith(PATH, { params });
  });

  it("keeps every assessment with who recorded it and when", async () => {
    renderSection();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    const [latest, earlier] = items.map((item) => within(item));
    latest.getByText("Motor seized.");
    expect(items[0]?.textContent).toContain("Recorded by Casey Doe");
    earlier.getByText("Annual service.");
    expect(items[1]?.textContent).toContain("Recorded by Unknown user");
    expect(items[1]?.textContent).toContain("Good");
  });

  it("says when an asset has never been assessed, and closes recording on a deactivated asset", async () => {
    history = [];
    renderSection(false);
    expect(
      (await screen.findByRole("status", { name: "Current condition" }))
        .textContent
    ).toContain("Not assessed yet");
    expect(
      screen.queryByRole("button", { name: "Record assessment" })
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
      await screen.findByRole("button", { name: "Record assessment" })
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Condition" }), {
      target: { value: "NEEDS_ATTENTION" },
    });
    fireEvent.change(screen.getByLabelText("Assessment date"), {
      target: { value: "2026-09-27" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), {
      target: { value: "Noisy bearing." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record assessment" }));

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
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
