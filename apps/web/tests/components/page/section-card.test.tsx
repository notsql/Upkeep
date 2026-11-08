import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it } from "vitest";
import { PageSection, SectionCard } from "@/components/page/section-card";

it("labels the section by its heading and holds actions and content", () => {
  renderWithProviders(
    <SectionCard
      actions={<button type="button">Upload</button>}
      title="Documents"
    >
      <p>List</p>
    </SectionCard>
  );
  const section = screen.getByRole("region", { name: "Documents" });
  within(section).getByRole("heading", { level: 2, name: "Documents" });
  within(section).getByRole("button", { name: "Upload" });
  within(section).getByText("List");
});

it("respects the heading level", () => {
  renderWithProviders(
    <SectionCard level={3} title="History">
      <p>x</p>
    </SectionCard>
  );
  expect(
    screen.getByRole("heading", { level: 3, name: "History" })
  ).toBeTruthy();
});

it("renders a page section without a card around it", () => {
  renderWithProviders(
    <PageSection actions={<button type="button">Add</button>} title="Devices">
      <p>Rows</p>
    </PageSection>
  );
  const section = screen.getByRole("region", { name: "Devices" });
  within(section).getByRole("heading", { level: 2, name: "Devices" });
  within(section).getByRole("button", { name: "Add" });
  within(section).getByText("Rows");
  expect(section.closest("[data-slot='card']")).toBeNull();
});
