import type { components } from "@proj/api/schema";
import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { FileSpreadsheet } from "lucide-react";
import { FilterBar } from "@/components/filters/filter-bar";
import { PageSection } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import type { PagedList } from "@/lib/infinite-list";
import type { ReadingImportOutcome } from "@/lib/reading-imports";
import { ImportRowResults } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/import-row-results";

/** The trigger shows these labels, never the codes. */
const OUTCOME_ITEMS = [
  { value: "ALL", label: "All outcomes" },
  { value: "IMPORTED", label: "Imported" },
  { value: "DUPLICATE", label: "Already recorded" },
  { value: "INVALID", label: "Has problems" },
];

export function ImportBatchResults({
  rows,
  page,
  outcome,
  onClearOutcome,
  onOutcomeChange,
  onRetry,
  onNext,
  onPrevious,
}: {
  rows: PagedList<components["schemas"]["ReadingImportRowPage"]>;
  page: number;
  outcome: ReadingImportOutcome | undefined;
  onClearOutcome: () => void;
  onOutcomeChange: (value: string | null) => void;
  onRetry: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <PageSection title="Row results">
      <FilterBar
        activeCount={outcome ? 1 : 0}
        label="Import result filters"
        onClear={onClearOutcome}
      >
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor="import-outcome">Outcome</FieldLabel>
          <Select
            items={OUTCOME_ITEMS}
            onValueChange={onOutcomeChange}
            value={outcome ?? "ALL"}
          >
            <SelectTrigger className="w-full" id="import-outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
      {rows.isPending ? (
        <LoadingState label="Loading row results…" rows={3} />
      ) : null}
      {rows.error ? (
        <ErrorState message={rows.error.message} onRetry={onRetry} />
      ) : null}
      {rows.data?.items.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No matching row results" />
      ) : null}
      <ImportRowResults items={rows.data?.items ?? []} />
      {rows.data && rows.more ? <LoadMore {...rows.more} /> : null}
      {rows.data && !rows.more ? (
        <Pagination
          canNext={(page + 1) * rows.data.size < rows.data.totalItems}
          canPrevious={page > 0}
          disabled={rows.isFetching}
          label="Import result pages"
          onNext={onNext}
          onPrevious={onPrevious}
          summary={`${rows.data.totalItems} ${rows.data.totalItems === 1 ? "record" : "records"}`}
        />
      ) : null}
    </PageSection>
  );
}
