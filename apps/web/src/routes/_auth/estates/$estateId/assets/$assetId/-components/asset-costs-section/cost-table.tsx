import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
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
import { Fragment } from "react";
import { useMobile } from "@/lib/use-mobile";

export interface CostRow {
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

function rowKey(row: CostRow): string {
  return `${row.workOrder ? "work" : "manual"}-${row.id}`;
}

function breakdown(row: CostRow): string {
  const parts = [
    `Labour ${row.labour ?? "unknown"}`,
    `Parts ${row.parts ?? "unknown"}`,
  ];
  if (!row.workOrder) {
    parts.push(`Other ${row.other ?? "unknown"}`);
  }
  return parts.join(" · ");
}

function CostItemBody({ row }: { row: CostRow }) {
  return (
    <>
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
          {row.label}
        </ItemTitle>
        <ItemDescription className="text-xs">{row.date}</ItemDescription>
        <ItemDescription className="text-xs">{breakdown(row)}</ItemDescription>
      </ItemContent>
      <ItemActions className="flex-col items-end gap-0">
        <span className="font-semibold tabular-nums">
          {row.total ?? "Unknown"}
        </span>
        <span className="text-muted-foreground text-xs">SGD</span>
      </ItemActions>
    </>
  );
}

function CostList({
  canView,
  estateId,
  rows,
}: {
  canView: boolean;
  estateId: string;
  rows: CostRow[];
}) {
  return (
    <ItemGroup aria-label="Cost entries" className="gap-0">
      {rows.map((row, index) => (
        <Fragment key={rowKey(row)}>
          {index > 0 ? <ItemSeparator className="my-0" /> : null}
          {/* biome-ignore lint/a11y/useSemanticElements: ItemGroup is a div with role="list", so a bare li would be invalid. */}
          <div role="listitem">
            {row.workOrder && canView ? (
              <Item
                className="flex-nowrap items-start"
                render={
                  <Link
                    params={{ estateId, workOrderId: row.workOrder.id }}
                    to="/estates/$estateId/work-orders/$workOrderId"
                  />
                }
                size="sm"
              >
                <CostItemBody row={row} />
              </Item>
            ) : (
              <Item className="flex-nowrap items-start" size="sm">
                <CostItemBody row={row} />
              </Item>
            )}
          </div>
        </Fragment>
      ))}
    </ItemGroup>
  );
}

export function CostTable({
  canView,
  estateId,
  rows,
}: {
  canView: boolean;
  estateId: string;
  rows: CostRow[];
}) {
  const mobile = useMobile();
  const unknown = rows.filter(hasUnknownCost).length;
  const labour = sum(rows.map((row) => row.labour));
  const parts = sum(rows.map((row) => row.parts));
  const other = sum(rows.map((row) => row.other));
  const summary = [
    { label: "Labour", value: labour },
    { label: "Parts", value: parts },
    { label: "Other", value: other },
    { label: unknown ? "Known total" : "Total", value: labour + parts + other },
  ];
  return (
    <>
      <section aria-label="Cost summary">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {summary.map((item) => (
            <div className="grid gap-0.5" key={item.label}>
              <dt className="text-muted-foreground text-xs">{item.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatCents(item.value)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground mt-1 text-xs">Amounts in SGD</p>
      </section>
      {mobile ? (
        <CostList canView={canView} estateId={estateId} rows={rows} />
      ) : (
        <Table>
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
              <TableRow key={rowKey(row)}>
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
      )}
      {unknown ? (
        <p className="text-muted-foreground mt-2">
          {unknown === 1 ? "1 entry has" : `${unknown} entries have`} unknown
          costs, not included in the totals.
        </p>
      ) : null}
    </>
  );
}
