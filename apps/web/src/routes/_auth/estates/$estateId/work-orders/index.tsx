import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import type { WorkOrderListSearch } from "@/lib/work-orders";
import { WorkOrderListPage } from "./-components/work-order-list-page";
export const Route = createFileRoute("/_auth/estates/$estateId/work-orders/")({
  validateSearch: (search: Record<string, unknown>): WorkOrderListSearch => {
    const { priority, q, cursor, sortBy, direction } = search;
    const status = parseStatus(search.status);
    const category = parseCategory(search.category);
    if (
      sortBy !== undefined &&
      sortBy !== "CREATED_AT" &&
      sortBy !== "REFERENCE" &&
      sortBy !== "CATEGORY" &&
      sortBy !== "PRIORITY"
    ) {
      throw new Error("Choose a valid work-order sort column.");
    }
    if (
      direction !== undefined &&
      direction !== "ASC" &&
      direction !== "DESC"
    ) {
      throw new Error("Choose a valid sort direction.");
    }
    if (
      priority !== undefined &&
      priority !== "" &&
      priority !== "LOW" &&
      priority !== "MEDIUM" &&
      priority !== "HIGH" &&
      priority !== "URGENT"
    ) {
      throw new Error("Choose a valid work-order priority.");
    }
    if (q !== undefined && (typeof q !== "string" || q.length > 200)) {
      throw new Error("Reference search must be at most 200 characters.");
    }
    return {
      ...(sortBy ? { sortBy } : {}),
      ...(direction ? { direction } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(typeof q === "string" && q.trim() ? { q: q.trim() } : {}),
      ...(typeof cursor === "string" && cursor ? { cursor } : {}),
    };
  },
  component: WorkOrderListRoute,
  head: () => ({ meta: [{ title: "Work orders" }] }),
});
function WorkOrderListRoute() {
  const { estateId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const navigateSearch = useCallback(
    (values: WorkOrderListSearch) => {
      const sortChanged =
        values.sortBy !== search.sortBy ||
        values.direction !== search.direction;
      return navigate({ search: values, resetScroll: !sortChanged });
    },
    [navigate, search.sortBy, search.direction]
  );
  return (
    <WorkOrderListPage
      estateId={estateId}
      key={estateId}
      onChange={navigateSearch}
      search={search}
    />
  );
}

function parseStatus(value: unknown): WorkOrderListSearch["status"] {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (
    value === "OPEN" ||
    value === "ASSIGNED" ||
    value === "IN_PROGRESS" ||
    value === "CLOSED"
  ) {
    return value;
  }
  throw new Error("Choose a valid work-order status.");
}
function parseCategory(value: unknown): WorkOrderListSearch["category"] {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (
    value === "EQUIPMENT_FAULT" ||
    value === "CLEANLINESS" ||
    value === "SAFETY"
  ) {
    return value;
  }
  throw new Error("Choose a valid work-order category.");
}
