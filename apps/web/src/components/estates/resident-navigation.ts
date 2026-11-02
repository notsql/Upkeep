import type { components } from "@proj/api/schema";
import { ClipboardList, ClipboardPenLine } from "lucide-react";
import type { NavigationItem } from "@/components/app-navigation";

const REPORT_DETAIL_PATH = /^\/reports\/[^/]+/;

export function residentNavigation(
  access: components["schemas"]["AppAccessResponse"],
  estateId: string | undefined,
  pathname: string
): { local: NavigationItem[]; global: NavigationItem[] } {
  const residents = access.estates.filter(
    (estate) => estate.role === "RESIDENT"
  );
  const active = residents.filter((estate) =>
    access.residentEstates.some(
      (assignment) => assignment.id === estate.estateId
    )
  );
  const reporting: NavigationItem = {
    label: "Report a fault",
    to: "/reports/new",
    icon: ClipboardPenLine,
    active: pathname.startsWith("/reports/new"),
  };
  const history: NavigationItem = {
    label: "My reports",
    to: "/reports",
    icon: ClipboardList,
    active:
      pathname === "/reports" ||
      (REPORT_DETAIL_PATH.test(pathname) &&
        !pathname.startsWith("/reports/new")),
  };
  if (estateId) {
    if (!residents.some((estate) => estate.estateId === estateId)) {
      return { local: [], global: [] };
    }
    const local: NavigationItem[] = [{ ...history, search: { estateId } }];
    if (active.some((estate) => estate.estateId === estateId)) {
      local.push({ ...reporting, search: { estateId } });
    }
    return { local, global: [] };
  }
  const global: NavigationItem[] = [];
  if (active.length) {
    global.push({
      ...reporting,
      search:
        active.length === 1 ? { estateId: active[0].estateId } : undefined,
      chooseEstate: active.length > 1 ? "report-creation" : undefined,
    });
  }
  if (residents.length) {
    global.push({
      ...history,
      search:
        residents.length === 1
          ? { estateId: residents[0].estateId }
          : undefined,
      chooseEstate: residents.length > 1 ? "resident-reports" : undefined,
    });
  }
  return { local: [], global };
}
