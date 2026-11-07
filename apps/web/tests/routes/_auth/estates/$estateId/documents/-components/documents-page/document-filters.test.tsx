import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { DocumentFiltersForm } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-filters";

it("counts applied filters and clears them all from the filter header", () => {
  const onSearch = vi.fn();
  renderWithProviders(
    <DocumentFiltersForm
      filters={{ filename: "pump", documentType: "INVOICE" }}
      onSearch={onSearch}
    />
  );
  screen.getByText("2 active");
  expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(onSearch).toHaveBeenCalledWith({});
});
