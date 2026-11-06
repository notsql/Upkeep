import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { DateRangePicker } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/date-range-picker";

const PERIOD = /Period/u;

it("summarises the range on its trigger", () => {
  renderWithProviders(
    <DateRangePicker
      aria-label="Period"
      onChange={vi.fn()}
      value={{ from: "2026-03-01", to: "2026-03-31" }}
    />
  );
  const text = screen.getByRole("button", { name: PERIOD }).textContent;
  expect(text).toContain("1 Mar 2026");
  expect(text).toContain("31 Mar 2026");
});

it("emits from and to as YYYY-MM-DD", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <DateRangePicker
      aria-label="Period"
      onChange={onChange}
      value={{ from: "2026-03-01", to: "" }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: PERIOD }));
  const [grid] = await screen.findAllByRole("grid");
  const day = Array.from(grid.querySelectorAll("button")).find(
    (button) => button.textContent === "10"
  );
  if (!day) {
    throw new Error("Day 10 not rendered");
  }
  fireEvent.click(day);
  expect(onChange).toHaveBeenCalledWith({
    from: "2026-03-01",
    to: "2026-03-10",
  });
});
