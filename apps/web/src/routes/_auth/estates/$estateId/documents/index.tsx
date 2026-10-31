import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback } from "react";
import { useAuthenticatedSession } from "@/lib/access";
import type { DocumentFilters } from "@/lib/documents";
import { DocumentsPage } from "./-components/documents-page";

export const Route = createFileRoute("/_auth/estates/$estateId/documents/")({
  validateSearch: (search: Record<string, unknown>): DocumentFilters => ({
    ...(typeof search.filename === "string" && search.filename.trim()
      ? { filename: search.filename.trim() }
      : {}),
    ...(typeof search.cursor === "string" && search.cursor
      ? { cursor: search.cursor }
      : {}),
    ...(search.documentType === "INVOICE" ||
    search.documentType === "SERVICE_REPORT"
      ? { documentType: search.documentType }
      : {}),
  }),
  beforeLoad: ({ location, params, search }) => {
    const type =
      "documentType" in location.search
        ? location.search.documentType
        : undefined;
    if (type === undefined || type === "INVOICE" || type === "SERVICE_REPORT") {
      return;
    }
    throw redirect({
      to: "/estates/$estateId/documents",
      params,
      search: {
        ...(search.filename ? { filename: search.filename } : {}),
        ...(search.cursor ? { cursor: search.cursor } : {}),
      },
    });
  },
  component: DocumentsRoute,
  head: () => ({ meta: [{ title: "Documents" }] }),
});

function DocumentsRoute() {
  const { estateId } = Route.useParams();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const { userId } = useAuthenticatedSession();
  const search = useCallback(
    (values: DocumentFilters) => navigate({ search: values }),
    [navigate]
  );
  return (
    <DocumentsPage
      estateId={estateId}
      filters={filters}
      key={`${userId}:${estateId}`}
      onSearch={search}
    />
  );
}
