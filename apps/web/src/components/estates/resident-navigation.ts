import type { components } from "@proj/api/schema";
import { ClipboardList, ClipboardPenLine, LayoutDashboard } from "lucide-react";
import type { NavigationItem } from "@/components/navigation-item";

const REPORT_DETAIL_PATH = /^\/reports\/[^/]+/u;

/** The resident sidebar for the selected resident estate. */
export function residentNavigation(
  access: components["schemas"]["AppAccessResponse"],
  estateId: string | undefined,
  pathname: string
): NavigationItem[] {
  if (
    !(
      estateId &&
      access.estates.some(
        (estate) => estate.estateId === estateId && estate.role === "RESIDENT"
      )
    )
  ) {
    return [];
  }
  const items: NavigationItem[] = [];
  // Mixed resident + staff accounts follow the staff redirect at `/`.
  if (!access.canEnterWorkspace) {
    items.push({
      label: "Dashboard",
      to: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
      search: { estateId },
    });
  }
  if (access.residentEstates.some((estate) => estate.id === estateId)) {
    items.push({
      label: "Report a fault",
      to: "/reports/new",
      icon: ClipboardPenLine,
      active: pathname.startsWith("/reports/new"),
      search: { estateId },
    });
  }
  items.push({
    label: "My reports",
    to: "/reports",
    icon: ClipboardList,
    active:
      pathname === "/reports" ||
      (REPORT_DETAIL_PATH.test(pathname) &&
        !pathname.startsWith("/reports/new")),
    search: { estateId },
  });
  return items;
}
