import type { EstateStatus } from "@/lib/estates";

export type EstateAccess = "ALL" | "OWNED" | "SHARED";
export interface EstateDirectoryFilters {
  access?: EstateAccess;
  q?: string;
  status?: EstateStatus;
}

export function validateEstateDirectorySearch(
  search: Record<string, unknown>
): EstateDirectoryFilters {
  return {
    q: typeof search.q === "string" ? search.q || undefined : undefined,
    status:
      typeof search.status === "string" &&
      ["ACTIVE", "INACTIVE", "ALL"].includes(search.status)
        ? (search.status as EstateStatus)
        : undefined,
    access:
      typeof search.access === "string" &&
      ["ALL", "OWNED", "SHARED"].includes(search.access)
        ? (search.access as EstateAccess)
        : undefined,
  };
}
