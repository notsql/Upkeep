import { render, screen, within } from "@testing-library/react";
import { Shield } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ListRow, ListRows } from "@/components/list/list-row";

describe("ListRow", () => {
  it("renders title, meta and trailing inside a labelled flat list", () => {
    render(
      <ListRows label="Roles">
        <ListRow
          icon={Shield}
          meta="2 permissions"
          title="Cleaner"
          trailing={<button type="button">Actions for Cleaner</button>}
        />
      </ListRows>
    );
    const list = screen.getByRole("list", { name: "Roles" });
    const row = within(list).getByRole("listitem");
    within(row).getByText("Cleaner");
    within(row).getByText("2 permissions");
    within(row).getByRole("button", { name: "Actions for Cleaner" });
    expect(list.className).not.toContain("rounded-xl");
    expect(list.className).not.toContain("bg-card");
  });

  it("hides the icon tile from assistive technology", () => {
    render(
      <ListRows label="People">
        <ListRow initial="A" title="Alice" />
      </ListRows>
    );
    const tile = screen.getByText("A");
    expect(tile.getAttribute("aria-hidden")).toBe("true");
  });
});
