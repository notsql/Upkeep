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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useState,
} from "react";
import {
  useWorkOrderList,
  type WorkOrder,
  type WorkOrderFilters,
} from "@/lib/work-orders";

const statusItems = [
  { value: "ALL", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "CLOSED", label: "Closed" },
];

function WorkOrderChoice({
  order,
  onSelect,
}: {
  order: WorkOrder;
  onSelect: (order: WorkOrder) => void;
}) {
  const select = useCallback(() => onSelect(order), [onSelect, order]);
  return (
    <TableRow>
      <TableCell>
        <p>{order.reference}</p>
        <p className="whitespace-pre-wrap">{order.description}</p>
      </TableCell>
      <TableCell>{order.status.replaceAll("_", " ")}</TableCell>
      <TableCell>{order.locationPath}</TableCell>
      <TableCell>
        <Button
          aria-label={`Select ${order.reference}`}
          onClick={select}
          type="button"
          variant="outline"
        >
          Select
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function WorkOrderPicker({
  estateId,
  onSelect,
}: {
  estateId: string;
  onSelect: (order: WorkOrder) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkOrderFilters["status"]>();
  const [filters, setFilters] = useState<WorkOrderFilters>({});
  const [cursor, setCursor] = useState<string>();
  const orders = useWorkOrderList(estateId, filters, cursor);
  const search = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFilters({ q: query.trim() || undefined, status });
      setCursor(undefined);
    },
    [query, status]
  );
  const changeQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    []
  );
  const changeStatus = useCallback(
    (value: string | null) =>
      setStatus(
        value && value !== "ALL"
          ? (value as WorkOrderFilters["status"])
          : undefined
      ),
    []
  );
  const retry = useCallback(() => orders.refetch(), [orders.refetch]);
  const first = useCallback(() => setCursor(undefined), []);
  const next = useCallback(
    () => setCursor(orders.data?.nextCursor ?? undefined),
    [orders.data?.nextCursor]
  );
  return (
    <section aria-label="Choose work order" className="min-w-0 space-y-3">
      <form className="space-y-3" onSubmit={search}>
        <div className="space-y-2">
          <Label htmlFor={`${id}-search`}>Search work-order reference</Label>
          <Input
            id={`${id}-search`}
            maxLength={200}
            onChange={changeQuery}
            value={query}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-status`}>Work-order status</Label>
          <Select
            items={statusItems}
            onValueChange={changeStatus}
            value={status ?? "ALL"}
          >
            <SelectTrigger id={`${id}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Search work orders</Button>
      </form>
      {orders.isPending ? <p role="status">Loading work orders…</p> : null}
      {orders.isError ? (
        <div role="alert">
          Unable to load work orders.{" "}
          <Button onClick={retry} type="button" variant="outline">
            Retry work orders
          </Button>
        </div>
      ) : null}
      {!orders.isError && orders.data?.items.length === 0 ? (
        <p>No matching work orders.</p>
      ) : null}
      {!orders.isError && orders.data?.items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Work order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Choose</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data.items.map((order) => (
              <WorkOrderChoice
                key={order.id}
                onSelect={onSelect}
                order={order}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {cursor ? (
          <Button onClick={first} type="button" variant="outline">
            First page
          </Button>
        ) : null}
        {orders.data?.nextCursor ? (
          <Button onClick={next} type="button" variant="outline">
            Next work orders
          </Button>
        ) : null}
      </div>
    </section>
  );
}
