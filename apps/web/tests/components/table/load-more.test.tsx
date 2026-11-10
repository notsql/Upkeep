import { intersect } from "@tests/intersection";
import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { LoadMore } from "@/components/table/load-more";

it("fetches the next page when the sentinel scrolls into view", () => {
  const fetchNextPage = vi.fn();
  renderWithProviders(
    <LoadMore
      fetchNextPage={fetchNextPage}
      hasNextPage
      isFetchingNextPage={false}
    />
  );
  intersect();
  expect(fetchNextPage).toHaveBeenCalledOnce();
});

it("waits while the next page is already loading", () => {
  const fetchNextPage = vi.fn();
  renderWithProviders(
    <LoadMore fetchNextPage={fetchNextPage} hasNextPage isFetchingNextPage />
  );
  screen.getByRole("status", { name: "Loading more…" });
  intersect();
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it("says the list is finished when nothing is left", () => {
  const fetchNextPage = vi.fn();
  renderWithProviders(
    <LoadMore
      fetchNextPage={fetchNextPage}
      hasNextPage={false}
      isFetchingNextPage={false}
    />
  );
  screen.getByText("That's everything");
  intersect();
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it("stops auto-loading after a failure and offers a retry", () => {
  const fetchNextPage = vi.fn();
  renderWithProviders(
    <LoadMore
      failed
      fetchNextPage={fetchNextPage}
      hasNextPage
      isFetchingNextPage={false}
    />
  );
  intersect();
  expect(fetchNextPage).not.toHaveBeenCalled();
  screen.getByRole("button", { name: "Try again" }).click();
  expect(fetchNextPage).toHaveBeenCalledOnce();
});
