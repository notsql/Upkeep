import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import { localToday } from "@/lib/assessments";
import { RecordEventDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/record-event-dialog";

const REQUIRED = /required/i;

function typeField() {
  return screen.getByRole("combobox", { name: "Type" });
}
function dateField() {
  // Date inputs have no ARIA role, so fall back to the label.
  return screen.getByLabelText<HTMLInputElement>("Event date");
}
function notesField() {
  return screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Notes" });
}
function submitButton() {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "Record event",
  });
}

describe("RecordEventDialog", () => {
  it("labels the type, date and notes fields", async () => {
    renderWithProviders(
      <RecordEventDialog onCancel={vi.fn()} onSave={vi.fn()} />
    );
    screen.getByRole("dialog");
    fireEvent.click(typeField());
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent)
    ).toEqual(["Breakdown repair", "Preventive maintenance"]);
    expect(dateField().type).toBe("date");
    expect(dateField().value).toBe(localToday());
    expect(dateField().max).toBe(localToday());
    notesField();
  });

  it("starts on the given type", () => {
    renderWithProviders(
      <RecordEventDialog
        defaultType="BREAKDOWN_REPAIR"
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />
    );
    within(typeField()).getByText("Breakdown repair");
  });

  it("shows required errors instead of saving", async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <RecordEventDialog onCancel={vi.fn()} onSave={onSave} />
    );
    fireEvent.change(dateField(), { target: { value: "" } });
    fireEvent.change(notesField(), { target: { value: "   " } });
    fireEvent.click(submitButton());
    expect(await screen.findAllByText(REQUIRED)).toHaveLength(3);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("announces each missing required field as an alert", async () => {
    renderWithProviders(
      <RecordEventDialog onCancel={vi.fn()} onSave={vi.fn()} />
    );
    fireEvent.change(dateField(), { target: { value: "" } });
    fireEvent.change(notesField(), { target: { value: "   " } });
    fireEvent.click(submitButton());
    expect(
      (await screen.findAllByRole("alert")).map((alert) => alert.textContent)
    ).toEqual([
      "Type is required.",
      "Event date is required.",
      "Notes are required.",
    ]);
  });

  it("posts the type, date and trimmed notes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <RecordEventDialog onCancel={vi.fn()} onSave={onSave} />
    );
    await chooseOption(typeField(), "Preventive maintenance");
    fireEvent.change(dateField(), { target: { value: "2026-09-20" } });
    fireEvent.change(notesField(), {
      target: { value: "  Greased bearings.  " },
    });
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        type: "PREVENTIVE",
        occurredOn: "2026-09-20",
        notes: "Greased bearings.",
      })
    );
  });

  it("labels the optional maintenance details", () => {
    renderWithProviders(
      <RecordEventDialog onCancel={vi.fn()} onSave={vi.fn()} />
    );
    for (const name of [
      "Findings",
      "Work performed",
      "Service provider",
      "Parts replaced",
    ]) {
      screen.getByRole("textbox", { name });
    }
    screen.getByRole("spinbutton", { name: "Downtime (minutes)" });
  });

  it("posts the maintenance details trimmed, leaving out the blank ones", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <RecordEventDialog
        defaultType="BREAKDOWN_REPAIR"
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(dateField(), { target: { value: "2026-09-20" } });
    fireEvent.change(notesField(), { target: { value: "Pump tripped." } });
    fireEvent.change(screen.getByRole("textbox", { name: "Findings" }), {
      target: { value: "  Seal worn.  " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Work performed" }), {
      target: { value: "Replaced the seal." },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Service provider" }),
      { target: { value: "   " } }
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Downtime (minutes)" }),
      { target: { value: "0" } }
    );
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toStrictEqual({
      type: "BREAKDOWN_REPAIR",
      occurredOn: "2026-09-20",
      notes: "Pump tripped.",
      findings: "Seal worn.",
      workPerformed: "Replaced the seal.",
      downtimeMinutes: 0,
    });
  });

  it("rejects downtime that is not a whole number of minutes", async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <RecordEventDialog
        defaultType="BREAKDOWN_REPAIR"
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(notesField(), { target: { value: "Fixed." } });
    const downtime = screen.getByRole("spinbutton", {
      name: "Downtime (minutes)",
    });
    fireEvent.change(downtime, { target: { value: "1.5" } });
    fireEvent.click(submitButton());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Downtime must be a whole number of minutes."
    );
    expect(downtime.getAttribute("aria-invalid")).toBe("true");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps what was entered and explains a server error", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("This asset is deactivated."));
    renderWithProviders(
      <RecordEventDialog
        defaultType="BREAKDOWN_REPAIR"
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(dateField(), { target: { value: "2026-09-20" } });
    fireEvent.change(notesField(), { target: { value: "Impeller replaced." } });
    fireEvent.click(submitButton());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "deactivated"
    );
    within(typeField()).getByText("Breakdown repair");
    expect(dateField().value).toBe("2026-09-20");
    expect(notesField().value).toBe("Impeller replaced.");
    await waitFor(() => expect(submitButton().disabled).toBe(false));
  });

  it("does not submit twice while a save is pending", async () => {
    let finish: (value?: unknown) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    renderWithProviders(
      <RecordEventDialog
        defaultType="BREAKDOWN_REPAIR"
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );
    fireEvent.change(notesField(), { target: { value: "Impeller replaced." } });
    fireEvent.click(submitButton());
    const pending = await screen.findByRole<HTMLButtonElement>("button", {
      name: "Saving…",
    });
    expect(pending.disabled).toBe(true);
    fireEvent.click(pending);
    fireEvent.submit(pending.form as HTMLFormElement);
    finish();
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledOnce();
  });
});
