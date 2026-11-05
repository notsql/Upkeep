import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { pageHead } from "@/lib/page-title";
import { EstateReportsPage } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/estate-reports-page";
import type { EstateReportsSearch } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-search";

const INTEGER_POSITION = /^-?\d+$/u;

export const Route = createFileRoute("/_auth/estates/$estateId/reports/")({
  validateSearch: (search: Record<string, unknown>): EstateReportsSearch => {
    const minLevelPosition = position(search.minLevelPosition);
    const maxLevelPosition = position(search.maxLevelPosition);
    if (
      minLevelPosition !== undefined &&
      maxLevelPosition !== undefined &&
      minLevelPosition > maxLevelPosition
    ) {
      throw new Error("Minimum position must not exceed maximum position.");
    }
    return {
      ...(typeof search.blockId === "string" && search.blockId
        ? { blockId: search.blockId }
        : {}),
      ...(minLevelPosition === undefined ? {} : { minLevelPosition }),
      ...(maxLevelPosition === undefined ? {} : { maxLevelPosition }),
      ...(typeof search.cursor === "string" && search.cursor
        ? { cursor: search.cursor }
        : {}),
    };
  },
  component: EstateReportsRoute,
  head: () => pageHead("Fault reports"),
});

function EstateReportsRoute() {
  const { estateId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const changeSearch = useCallback(
    (values: EstateReportsSearch) => navigate({ search: values }),
    [navigate]
  );
  return (
    <EstateReportsPage
      estateId={estateId}
      onSearch={changeSearch}
      search={search}
    />
  );
}

function position(value: unknown): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !INTEGER_POSITION.test(String(value))
  ) {
    throw new Error("Level positions must be whole numbers.");
  }
  const number = Number(value);
  if (
    !Number.isInteger(number) ||
    number < -2_147_483_648 ||
    number > 2_147_483_647
  ) {
    throw new Error("Level position is outside the supported integer range.");
  }
  return number;
}
