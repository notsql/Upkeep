import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import type { DocumentFilters } from "@/lib/documents";

const TYPE_LABELS = {
  ALL: "All types",
  INVOICE: "Invoice",
  SERVICE_REPORT: "Service report",
};

export function DocumentFiltersForm({
  filters,
  onSearch,
}: {
  filters: DocumentFilters;
  onSearch: (filters: DocumentFilters) => void;
}) {
  const [value, setValue] = useState(filters.filename ?? "");
  const changeValue = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    []
  );
  const clear = useCallback(() => {
    setValue("");
    onSearch(
      filters.documentType ? { documentType: filters.documentType } : {}
    );
  }, [filters.documentType, onSearch]);
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSearch({
        ...(value.trim() ? { filename: value.trim() } : {}),
        ...(filters.documentType ? { documentType: filters.documentType } : {}),
      });
    },
    [filters.documentType, onSearch, value]
  );
  const changeType = useCallback(
    (documentType: string | null) => {
      onSearch({
        ...(filters.filename ? { filename: filters.filename } : {}),
        ...(documentType === "INVOICE" || documentType === "SERVICE_REPORT"
          ? { documentType }
          : {}),
      });
    },
    [filters.filename, onSearch]
  );
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
      <div className="grid flex-1 gap-2">
        <Label htmlFor="document-search">Search by filename</Label>
        <Input
          id="document-search"
          maxLength={255}
          onChange={changeValue}
          type="search"
          value={value}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="document-type-filter">Filter by type</Label>
        <Select
          onValueChange={changeType}
          value={filters.documentType ?? "ALL"}
        >
          <SelectTrigger aria-label="Filter by type" id="document-type-filter">
            <SelectValue>
              {TYPE_LABELS[filters.documentType ?? "ALL"]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="INVOICE">Invoice</SelectItem>
            <SelectItem value="SERVICE_REPORT">Service report</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">Search</Button>
      {filters.filename || value ? (
        <Button onClick={clear} type="button" variant="outline">
          Clear search
        </Button>
      ) : null}
    </form>
  );
}
