import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { localToday } from "@/lib/assessments";
import { AssessmentForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/assessment-form";
import {
  chooseOption,
  screen,
  waitFor,
  within,
} from "../../../../../../../test-utils";

const REQUIRED = /required/i;

function conditionField() {
  return screen.getByRole("combobox", { name: "Condition" });
}
function dateField() {
  // Date inputs have no ARIA role, so fall back to the label.
  return screen.getByLabelText<HTMLInputElement>("Assessment date");
}
function notesField() {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Notes" });
}
function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Record assessment" }));
}

describe("AssessmentForm", () => {
  it("offers every condition and starts on today's date", async () => {
    render(<AssessmentForm onSave={vi.fn()} />);
    within(conditionField()).getByText("Select a condition");
    fireEvent.click(conditionField());
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent)
    ).toEqual(["Good", "Needs attention", "Faulty"]);
    expect(dateField().value).toBe(localToday());
    expect(dateField().max).toBe(localToday());
  });

  it("records the condition, date and trimmed notes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AssessmentForm onSave={onSave} />);
    await chooseOption(conditionField(), "Needs attention");
    fireEvent.change(dateField(), { target: { value: "2026-09-20" } });
    fireEvent.change(notesField(), {
      target: { value: "  Seal weeping at the gland.  " },
    });
    submit();
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        condition: "NEEDS_ATTENTION",
        assessedOn: "2026-09-20",
        notes: "Seal weeping at the gland.",
      })
    );
  });

  it("requires a condition, a date and notes", async () => {
    const onSave = vi.fn();
    render(<AssessmentForm onSave={onSave} />);
    fireEvent.change(dateField(), { target: { value: "" } });
    fireEvent.change(notesField(), { target: { value: "   " } });
    submit();
    expect(await screen.findAllByText(REQUIRED)).toHaveLength(3);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects a date in the future", async () => {
    const onSave = vi.fn();
    render(<AssessmentForm onSave={onSave} />);
    await chooseOption(conditionField(), "Good");
    fireEvent.change(dateField(), { target: { value: "2999-01-01" } });
    fireEvent.change(notesField(), { target: { value: "Fine" } });
    submit();
    await screen.findByText("The assessment date cannot be in the future.");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps what was entered and explains a rejected assessment", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("This asset is deactivated."));
    render(<AssessmentForm onSave={onSave} />);
    await chooseOption(conditionField(), "Faulty");
    fireEvent.change(notesField(), { target: { value: "Motor seized." } });
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "deactivated"
    );
    within(conditionField()).getByText("Faulty");
    expect(notesField().value).toBe("Motor seized.");
  });
});
