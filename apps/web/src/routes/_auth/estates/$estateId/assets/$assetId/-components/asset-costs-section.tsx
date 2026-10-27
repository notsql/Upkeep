import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Empty } from "@proj/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useCallback, useId, useState } from "react";
import { assetEventTypeLabel, useAssetEvents } from "@/lib/asset-events";
import {
  useAssetWorkOrderCompletions,
  useWorkOrderAccess,
} from "@/lib/work-orders";

interface CostRow {
  at: string;
  date: string;
  id: string;
  label: string;
  labour: string | null;
  // Undefined for work orders, which record no other costs.
  other?: string | null;
  parts: string | null;
  total: string | null;
  workOrder?: { id: string; reference: string };
}

/** A completion time as the viewer's local YYYY-MM-DD, like a date input. */
function localDate(iso: string): string {
  const at = new Date(iso);
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

// Amounts are added as whole cents so sums are exact.
function cents(amount: string): number {
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function formatCents(totalCents: number): string {
  const fraction = String(totalCents % 100).padStart(2, "0");
  return `${Math.floor(totalCents / 100)}.${fraction}`;
}

function sum(values: (string | null | undefined)[]): number {
  let total = 0;
  for (const value of values) {
    if (value) {
      total += cents(value);
    }
  }
  return total;
}

function hasUnknownCost(row: CostRow): boolean {
  return row.labour === null || row.parts === null || row.other === null;
}

function CostTable({
  canView,
  estateId,
  rows,
}: {
  canView: boolean;
  estateId: string;
  rows: CostRow[];
}) {
  const unknown = rows.filter(hasUnknownCost).length;
  const labour = sum(rows.map((row) => row.labour));
  const parts = sum(rows.map((row) => row.parts));
  const other = sum(rows.map((row) => row.other));
  return (
    <>
      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Labour (SGD)</TableHead>
            <TableHead>Parts (SGD)</TableHead>
            <TableHead>Other (SGD)</TableHead>
            <TableHead>Total (SGD)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.workOrder ? "work" : "manual"}-${row.id}`}>
              <TableCell>{row.date}</TableCell>
              <TableCell>
                {row.workOrder && canView ? (
                  <Link
                    className="text-primary underline underline-offset-4"
                    params={{ estateId, workOrderId: row.workOrder.id }}
                    to="/estates/$estateId/work-orders/$workOrderId"
                  >
                    {row.label}
                  </Link>
                ) : (
                  row.label
                )}
              </TableCell>
              <TableCell>{row.labour ?? "Unknown"}</TableCell>
              <TableCell>{row.parts ?? "Unknown"}</TableCell>
              <TableCell>
                {row.workOrder ? "Not applicable" : (row.other ?? "Unknown")}
              </TableCell>
              <TableCell>{row.total ?? "Unknown"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableHead colSpan={2} scope="row">
              {unknown ? "Known costs" : "Total"}
            </TableHead>
            <TableCell>{formatCents(labour)}</TableCell>
            <TableCell>{formatCents(parts)}</TableCell>
            <TableCell>{formatCents(other)}</TableCell>
            <TableCell>{formatCents(labour + parts + other)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {unknown ? (
        <p className="mt-2 text-muted-foreground">
          {unknown === 1 ? "1 entry has" : `${unknown} entries have`} unknown
          costs, not included in the totals.
        </p>
      ) : null}
    </>
  );
}

export function AssetCostsSection({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const id = useId();
  const events = useAssetEvents(estateId, assetId);
  const completions = useAssetWorkOrderCompletions(estateId, assetId);
  const access = useWorkOrderAccess(estateId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const handleFrom = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFrom(event.target.value),
    []
  );
  const handleTo = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTo(event.target.value),
    []
  );

  const reversed = Boolean(from && to && from > to);
  const rows: CostRow[] = [
    ...(events.data ?? []).map((event) => ({
      at: event.occurredOn,
      date: event.occurredOn,
      id: event.id,
      label: assetEventTypeLabel[event.type],
      labour: event.labourCost ?? null,
      parts: event.partsCost ?? null,
      other: event.otherCost ?? null,
      total: event.totalCost ?? null,
    })),
    ...(completions.data ?? []).map((work) => ({
      at: work.completion.completedAt,
      date: localDate(work.completion.completedAt),
      id: work.completion.id,
      label: work.reference,
      labour: work.completion.labourCost ?? null,
      parts: work.completion.partsCost ?? null,
      total: work.completion.totalCost ?? null,
      workOrder: { id: work.workOrderId, reference: work.reference },
    })),
  ]
    // ISO dates compare correctly as strings.
    .filter((row) => !((from && row.date < from) || (to && row.date > to)))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const loaded = Boolean(events.data && completions.data);

  return (
    <section aria-labelledby="costs-heading" className="section-surface mt-6">
      <h2 className="font-semibold text-xl" id="costs-heading">
        Maintenance costs
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-from`}>From</FieldLabel>
          <Input
            aria-describedby={reversed ? `${id}-range-error` : undefined}
            aria-invalid={reversed || undefined}
            id={`${id}-from`}
            onChange={handleFrom}
            type="date"
            value={from}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-to`}>To</FieldLabel>
          <Input id={`${id}-to`} onChange={handleTo} type="date" value={to} />
        </Field>
      </div>
      {reversed ? (
        <FieldError className="mt-2" id={`${id}-range-error`}>
          The start date must be on or before the end date.
        </FieldError>
      ) : null}
      {events.isPending || completions.isPending ? (
        <p aria-live="polite" className="mt-4">
          Loading costs…
        </p>
      ) : null}
      {events.error || completions.error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>
            {(events.error ?? completions.error)?.message}
          </AlertDescription>
        </Alert>
      ) : null}
      {loaded && !reversed && rows.length === 0 ? (
        <Empty className="mt-4 border border-dashed" role="status">
          No maintenance costs in this period.
        </Empty>
      ) : null}
      {loaded && !reversed && rows.length > 0 ? (
        <CostTable
          canView={Boolean(access.canView)}
          estateId={estateId}
          rows={rows}
        />
      ) : null}
    </section>
  );
}
