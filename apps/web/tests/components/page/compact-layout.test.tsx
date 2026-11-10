import { renderWithProviders, screen } from "@tests/test-utils";
import { Gauge } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterToggle } from "@/components/filters/filter-toggle";
import { CreateButton } from "@/components/page/page-actions";
import { SectionCard } from "@/components/page/section-card";
import { SummaryCard } from "@/components/page/summary-card";

const desktopWidth = window.innerWidth;
afterEach(() => {
  window.innerWidth = desktopWidth;
});

function cardSize(name: string): string | undefined {
  return (
    screen
      .getByRole("region", { name })
      .closest<HTMLElement>('[data-slot="card"]')?.dataset.size ?? undefined
  );
}

function renderCards() {
  renderWithProviders(
    <>
      <SectionCard title="Documents">
        <p>List</p>
      </SectionCard>
      <SummaryCard icon={Gauge} title="Open work orders" value={3}>
        <p>Due soon</p>
      </SummaryCard>
    </>
  );
}

describe("compact mobile layout", () => {
  it("renders shared cards small on mobile", () => {
    window.innerWidth = 375;
    renderCards();
    expect(cardSize("Documents")).toBe("sm");
    expect(cardSize("Open work orders")).toBe("sm");
  });

  it("keeps shared cards full size on desktop", () => {
    window.innerWidth = 1280;
    renderCards();
    expect(cardSize("Documents")).toBe("default");
    expect(cardSize("Open work orders")).toBe("default");
  });

  it("shows header actions as labelled icons on mobile", () => {
    window.innerWidth = 375;
    renderWithProviders(
      <>
        <FilterToggle controls="f" expanded={false} onToggle={vi.fn()} />
        <CreateButton onClick={vi.fn()} />
      </>
    );
    expect(screen.getByRole("button", { name: "Filters" }).textContent).toBe(
      ""
    );
    expect(screen.getByRole("button", { name: "Create" }).textContent).toBe("");
  });

  it("keeps header action labels on desktop", () => {
    window.innerWidth = 1280;
    renderWithProviders(<CreateButton onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Create" }).textContent).toBe(
      "Create"
    );
  });
});
