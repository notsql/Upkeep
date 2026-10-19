import { fireEvent, render } from "@testing-library/react";
import { screen, waitFor, within } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { Location } from "@/lib/locations";
import { AddFloorsForm } from "@/routes/_auth/estates/$estateId/-components/add-floors-form";

const at = "2026-10-19T00:00:00Z";
function level(id: string, name: string, sortOrder: number): Location {
  return {
    id,
    type: "LEVEL",
    name,
    parentId: "b1",
    sortOrder,
    createdAt: at,
    updatedAt: at,
  };
}

function renderForm(
  overrides: Partial<Parameters<typeof AddFloorsForm>[0]> = {}
) {
  const props = {
    title: "Add floors to Blk 101",
    existingLevels: [level("l2", "L2", 2)],
    onSave: vi.fn().mockResolvedValue({ created: [], skipped: [] }),
    onDone: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<AddFloorsForm {...props} />);
  return props;
}

function enterRange(lowest: string, highest: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Lowest floor" }), {
    target: { value: lowest },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Highest floor" }), {
    target: { value: highest },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Add floors" }));
}

describe("AddFloorsForm", () => {
  it("previews every floor highest first and marks the ones the block already has", () => {
    renderForm();
    enterRange("B1", "L3");
    const preview = screen.getByRole("list", { name: "Floors to add" });
    expect(
      within(preview)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["L3", "L2 (already exists, will be skipped)", "L1", "B1"]);
    screen.getByText("4 floors: 3 new, 1 already exists.");
  });

  it("sends the range as floor numbers and reports what was created and skipped", async () => {
    const props = renderForm({
      onSave: vi
        .fn()
        .mockResolvedValue({ created: ["L3", "L1", "B1"], skipped: ["L2"] }),
    });
    enterRange("b1", "3");
    submit();
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(-1, 3));
    const result = await screen.findByRole("status");
    expect(result.textContent).toContain("Added 3 floors: L3, L1, B1.");
    expect(result.textContent).toContain("Skipped 1 that already existed: L2.");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onDone).toHaveBeenCalled();
  });

  it.each([
    ["X", "L3", "Enter floors like B2 or L25. There is no floor 0."],
    ["L0", "L3", "Enter floors like B2 or L25. There is no floor 0."],
    ["L5", "L1", "The lowest floor must not be above the highest floor."],
    ["L1", "L51", "Add at most 50 floors at a time."],
  ])(
    "rejects %s to %s before sending anything",
    async (lowest, highest, message) => {
      const props = renderForm();
      enterRange(lowest, highest);
      submit();
      await screen.findByText(message);
      expect(props.onSave).not.toHaveBeenCalled();
    }
  );

  it("keeps the range and explains a rejected request", async () => {
    renderForm({
      onSave: vi.fn().mockRejectedValue(new Error("This estate is inactive.")),
    });
    enterRange("L1", "L3");
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "inactive"
    );
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Highest floor" })
        .value
    ).toBe("L3");
  });
});
