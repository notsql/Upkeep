import { Button } from "@proj/ui/components/button";
import { type MouseEvent, useCallback } from "react";
import type { ReadingSearch } from "@/lib/reading-filters";

function pageItems(page: number, pages: number): (number | string)[] {
  if (pages <= 6) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  const current = page + 1;
  let numbers: number[];
  if (current <= 3) {
    numbers = [1, 2, 3, 4, pages];
  } else if (current >= pages - 2) {
    numbers = [1, pages - 3, pages - 2, pages - 1, pages];
  } else {
    numbers = [1, current - 1, current, current + 1, pages];
  }
  const items: (number | string)[] = [];
  let previous = 0;
  for (const number of numbers) {
    if (number > previous + 1) {
      items.push(`gap-${previous}`);
    }
    items.push(number);
    previous = number;
  }
  return items;
}

export function ReadingPagination({
  filters,
  total,
  size,
  placeholder,
  onChange,
}: {
  filters: ReadingSearch;
  total: number;
  size: number;
  placeholder: boolean;
  onChange: (filters: ReadingSearch) => void;
}) {
  const page = filters.page ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const goTo = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const selected = Number(event.currentTarget.value);
      onChange({ ...filters, page: selected === 0 ? undefined : selected });
    },
    [filters, onChange]
  );
  return (
    <nav aria-label="Pagination" className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Page {page + 1} of {pages} · {total}{" "}
        {total === 1 ? "reading" : "readings"}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          disabled={page === 0 || placeholder}
          onClick={goTo}
          value={page - 1}
          variant="outline"
        >
          Previous page
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {pageItems(page, pages).map((item) =>
            typeof item === "number" ? (
              <Button
                aria-current={item === page + 1 ? "page" : undefined}
                aria-label={`Go to page ${item}`}
                disabled={placeholder || item === page + 1}
                key={item}
                onClick={goTo}
                size="icon"
                value={item - 1}
                variant={item === page + 1 ? "default" : "outline"}
              >
                {item}
              </Button>
            ) : (
              <span aria-hidden="true" className="w-4 text-center" key={item}>
                …
              </span>
            )
          )}
        </div>
        <Button
          disabled={page >= pages - 1 || placeholder}
          onClick={goTo}
          value={page + 1}
          variant="outline"
        >
          Next page
        </Button>
      </div>
    </nav>
  );
}
