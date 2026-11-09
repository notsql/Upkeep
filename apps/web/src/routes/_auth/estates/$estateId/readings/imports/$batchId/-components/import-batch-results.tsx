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
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Pagination } from "@/components/table/pagination";
import type {
  ReadingImportOutcome,
  useReadingImportRows,
} from "@/lib/reading-imports";
import { ImportRowResults } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/import-row-results";

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
  rows: ReturnType<typeof useReadingImportRows>;
  page: number;
  outcome: ReadingImportOutcome | undefined;
  onClearOutcome: () => void;
  onOutcomeChange: (value: string | null) => void;
  onRetry: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <SectionCard title="Row results">
      <FilterBar
        activeCount={outcome ? 1 : 0}
        label="Import result filters"
        onClear={onClearOutcome}
      >
        <Field className="w-full sm:w-48">
          <FieldLabel htmlFor="import-outcome">Outcome</FieldLabel>
          <Select onValueChange={onOutcomeChange} value={outcome ?? "ALL"}>
            <SelectTrigger className="w-full" id="import-outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All outcomes</SelectItem>
              <SelectItem value="IMPORTED">Imported</SelectItem>
              <SelectItem value="DUPLICATE">Already imported</SelectItem>
              <SelectItem value="INVALID">Has problems</SelectItem>
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
      {rows.data ? (
        <Pagination
          canNext={(page + 1) * rows.data.size < rows.data.totalItems}
          canPrevious={page > 0}
          disabled={rows.isFetching}
          label="Import result pages"
          onNext={onNext}
          onPrevious={onPrevious}
          summary={`${rows.data.totalItems} records`}
        />
      ) : null}
    </SectionCard>
  );
}
