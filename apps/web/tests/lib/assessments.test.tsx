import type { components } from "@proj/api/schema";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { useCallback } from "react";
import { expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { type AssessmentInput, useRecordAssessment } from "@/lib/assessments";
import { useAssetFailureRisk, useEstateFailureRisk } from "@/lib/failure-risk";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const risk: components["schemas"]["FailureRiskResponse"] = {
  assetId: "asset-id",
  assetReference: "MG-A0001",
  assetName: "Booster pump",
  category: "PUMP",
  basis: "SERVICE_INTERVAL",
  failuresObserved: 0,
  daysSinceLastEvent: 1,
  probability30Days: 0.01,
  probability60Days: 0.02,
  probability90Days: 0.03,
  recommendedTimeframe: "BEYOND_90_DAYS",
  expectedEndOfLife: "2031-05-01",
  flagged: false,
  flagReasons: [],
};

function Forecasts({ condition }: { condition: AssessmentInput["condition"] }) {
  const asset = useAssetFailureRisk("estate-id", "asset-id");
  const estate = useEstateFailureRisk("estate-id");
  const { mutate, isSuccess } = useRecordAssessment("estate-id", "asset-id");
  const recordAssessment = useCallback(() => {
    mutate({ condition, assessedOn: "2026-10-21", notes: "Inspection" });
  }, [condition, mutate]);
  if (!(asset.data && estate.data)) {
    return <p>Loading forecasts</p>;
  }
  return (
    <>
      <p aria-label="Asset forecast" role="status">
        {asset.data.flagReasons.includes("CONDITION") ? "Flagged" : "Unflagged"}
      </p>
      <p aria-label="Estate forecast" role="status">
        {estate.data[0].flagReasons.includes("CONDITION")
          ? "Flagged"
          : "Unflagged"}
      </p>
      <button onClick={recordAssessment} type="button">
        Record assessment
      </button>
      {isSuccess ? <p>Assessment saved</p> : null}
    </>
  );
}

it.each(["FAULTY", "GOOD"] as const)(
  "refreshes the asset and estate condition flags after a %s assessment",
  async (condition) => {
    let flagged = condition === "GOOD";
    vi.mocked(api.GET).mockImplementation((path) => {
      const forecast: typeof risk = {
        ...risk,
        flagged,
        flagReasons: flagged ? ["CONDITION"] : [],
      };
      return Promise.resolve({
        data:
          path === "/estates/{estateId}/failure-risk" ? [forecast] : forecast,
        response: new Response(),
      } as never);
    });
    vi.mocked(api.POST).mockImplementation(() => {
      flagged = condition !== "GOOD";
      return Promise.resolve({
        data: { id: "assessment-id" },
        response: new Response(),
      } as never);
    });
    renderWithProviders(<Forecasts condition={condition} />);
    const assetForecast = await screen.findByRole("status", {
      name: "Asset forecast",
    });
    const estateForecast = await screen.findByRole("status", {
      name: "Estate forecast",
    });
    const initial = condition === "GOOD" ? "Flagged" : "Unflagged";
    expect(assetForecast.textContent).toBe(initial);
    expect(estateForecast.textContent).toBe(initial);
    fireEvent.click(screen.getByRole("button", { name: "Record assessment" }));
    await screen.findByText("Assessment saved");
    const expected = condition === "GOOD" ? "Unflagged" : "Flagged";
    await waitFor(() => {
      expect(assetForecast.textContent).toBe(expected);
      expect(estateForecast.textContent).toBe(expected);
    });
  }
);
