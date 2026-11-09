import { renderWithProviders, screen, within } from "@tests/test-utils";
import { CircleDot } from "lucide-react";
import { expect, it } from "vitest";
import { CountCard } from "@/routes/-components/home-page/resident-home/count-card";

it("shows the count with a decorative icon tile", () => {
  renderWithProviders(<CountCard icon={CircleDot} label="Open" value={3} />);
  const region = screen.getByRole("region", { name: "Open" });
  within(region).getByText("3");
  expect(
    region.querySelector("svg")?.closest("[aria-hidden='true']")
  ).toBeTruthy();
});
