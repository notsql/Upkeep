import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { Pagination } from "@/components/table/pagination";

it("moves between pages and disables the ends", () => {
  const onNext = vi.fn();
  renderWithProviders(
    <Pagination
      canNext
      canPrevious={false}
      label="Work order pages"
      onNext={onNext}
      onPrevious={vi.fn()}
      summary="1–20 of 45"
    />
  );
  const nav = screen.getByRole("navigation", { name: "Work order pages" });
  within(nav).getByText("1–20 of 45");
  expect(
    within(nav).getByRole<HTMLButtonElement>("button", {
      name: "Previous page",
    }).disabled
  ).toBe(true);
  fireEvent.click(within(nav).getByRole("button", { name: "Next page" }));
  expect(onNext).toHaveBeenCalledOnce();
});
