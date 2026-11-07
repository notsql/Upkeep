import { renderWithProviders, screen } from "@tests/test-utils";
import { Banknote } from "lucide-react";
import { expect, it } from "vitest";
import { SectionHeading } from "@/components/page/section-heading";

it("renders a section title at the requested level with a decorative icon", () => {
  renderWithProviders(
    <SectionHeading icon={Banknote} id="costs" level={3}>
      Maintenance costs
    </SectionHeading>
  );
  const heading = screen.getByRole("heading", {
    name: "Maintenance costs",
    level: 3,
  });
  expect(heading.id).toBe("costs");
  expect(heading.querySelector("svg[aria-hidden='true']")).not.toBeNull();
});

it("defaults to a level-2 heading", () => {
  renderWithProviders(<SectionHeading>Locations</SectionHeading>);
  screen.getByRole("heading", { name: "Locations", level: 2 });
});
