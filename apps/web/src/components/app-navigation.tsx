import type { components } from "@proj/api/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@proj/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Files,
  Gauge,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  Wrench,
} from "lucide-react";
import { DestinationLink } from "@/components/destination-link";
import { residentNavigation } from "@/components/estates/resident-navigation";
import type { Destination, NavigationItem } from "@/components/navigation-item";
import { useAppAccess } from "@/lib/access";
import {
  canOpenAssetCategories,
  canOpenAssets,
  canOpenDevices,
  canOpenDocuments,
  canOpenEstateSettings,
  canOpenFailureRisk,
  canOpenFaultReports,
  canOpenInspections,
  canOpenMembers,
  canOpenOverview,
  canOpenReadings,
  canOpenRoles,
  canOpenSensors,
  canOpenWorkOrders,
} from "@/lib/estate-destinations";
import { useEstate } from "@/lib/estates";

const ESTATE_PATH = /^\/estates\/(?<estateId>[^/]+)/u;

interface NavigationGroup {
  items: NavigationItem[];
  label?: string;
}

/** Resident-only accounts get their dashboard, and so the resident area, at `/`. */
function isResidentPage(pathname: string, residentOnly = false): boolean {
  return (
    (residentOnly && pathname === "/") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/")
  );
}

export function isResidentOnly(
  access: components["schemas"]["AppAccessResponse"] | undefined
): boolean {
  return Boolean(access?.hasResidentMembership && !access.canEnterWorkspace);
}

/**
 * The estate the page is about, from the URL only: the estate path segment,
 * or on resident pages the `estateId` search param, else the sole resident
 * estate.
 */
export function useCurrentEstate() {
  const access = useAppAccess();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const searchEstate = useRouterState({
    select: (state) =>
      (state.location.search as { estateId?: string }).estateId,
  });
  let candidate = pathname.match(ESTATE_PATH)?.groups?.estateId;
  if (!candidate && isResidentPage(pathname, isResidentOnly(access.data))) {
    candidate = searchEstate;
    if (!candidate && access.data?.residentEstates.length === 1) {
      candidate = access.data.residentEstates[0]?.id;
    }
  }
  const permission = access.data?.estates.find(
    (item) => item.estateId === candidate
  );
  const estateId =
    candidate && candidate !== "new" && permission ? candidate : undefined;
  return { access, pathname, estateId, permission };
}

type Permission = components["schemas"]["EstateAccessResponse"];

function estateGroups(
  estateId: string,
  permission: Permission,
  owned: boolean | undefined,
  platformAdmin: boolean | undefined,
  pathname: string
): NavigationGroup[] {
  const base = `/estates/${estateId}`;
  const item = (
    label: string,
    to: Destination,
    icon: LucideIcon,
    shown: boolean
  ): NavigationItem[] => {
    if (!shown) {
      return [];
    }
    const section = to.replace("/estates/$estateId", base);
    return [
      {
        label,
        to,
        icon,
        estateId,
        active:
          section === base
            ? pathname === base || pathname === `${base}/`
            : pathname === section || pathname.startsWith(`${section}/`),
      },
    ];
  };
  return [
    {
      items: item(
        "Overview",
        "/estates/$estateId",
        LayoutDashboard,
        canOpenOverview(permission)
      ),
    },
    {
      label: "Operations",
      items: [
        ...item(
          "Work orders",
          "/estates/$estateId/work-orders",
          Wrench,
          canOpenWorkOrders(permission)
        ),
        ...item(
          "Fault reports",
          "/estates/$estateId/reports",
          ClipboardList,
          canOpenFaultReports(permission)
        ),
        ...item(
          "Inspections",
          "/estates/$estateId/inspections",
          ClipboardCheck,
          canOpenInspections(permission, owned)
        ),
      ],
    },
    {
      label: "Assets",
      items: [
        ...item(
          "Locations",
          "/estates/$estateId/locations",
          MapPin,
          Boolean(permission.canViewManagement)
        ),
        ...item(
          "Assets",
          "/estates/$estateId/assets",
          Layers,
          canOpenAssets(permission)
        ),
        ...item(
          "Devices",
          "/estates/$estateId/devices",
          Cpu,
          canOpenDevices(permission, owned)
        ),
        ...item(
          "Readings",
          "/estates/$estateId/readings",
          Activity,
          canOpenReadings(permission)
        ),
        ...item(
          "Device monitoring",
          "/estates/$estateId/sensors",
          Gauge,
          canOpenSensors(permission, owned, platformAdmin)
        ),
        ...item(
          "Failure risk",
          "/estates/$estateId/failure-risk",
          AlertTriangle,
          canOpenFailureRisk(permission, owned)
        ),
      ],
    },
    {
      label: "Records",
      items: item(
        "Documents",
        "/estates/$estateId/documents",
        Files,
        canOpenDocuments(permission)
      ),
    },
    {
      label: "Administration",
      items: [
        ...item(
          "Members",
          "/estates/$estateId/council",
          Users,
          canOpenMembers(permission)
        ),
        ...item(
          "Roles",
          "/estates/$estateId/roles",
          ShieldCheck,
          canOpenRoles(permission)
        ),
        ...item(
          "Asset categories",
          "/estates/$estateId/asset-categories",
          Tags,
          canOpenAssetCategories(permission, owned)
        ),
        ...item(
          "Estate settings",
          "/estates/$estateId/edit",
          Settings,
          canOpenEstateSettings(permission, owned)
        ),
      ],
    },
  ];
}

function useNavigationGroups(): NavigationGroup[] {
  const { access, pathname, estateId, permission } = useCurrentEstate();
  // Ownership comes from the estate itself; only management roles may read it.
  const estate = useEstate(
    permission?.canViewManagement ? estateId : undefined
  );
  if (!(access.data && estateId && permission) || access.isError) {
    return [];
  }
  if (permission.role === "RESIDENT") {
    return [{ items: residentNavigation(access.data, estateId, pathname) }];
  }
  return estateGroups(
    estateId,
    permission,
    estate.data?.owned,
    access.data.canAccessPlatformAdmin,
    pathname
  ).filter((group) => group.items.length > 0);
}

export function AppNavigation() {
  const groups = useNavigationGroups();
  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center border-b px-4">
        <Link
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          to="/"
        >
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          UpKeep
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Sidebar">
          {groups.map((group) => (
            <SidebarGroup
              aria-label={group.label}
              key={group.label ?? "overview"}
              role={group.label ? "group" : undefined}
            >
              {group.label ? (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              ) : null}
              <SidebarMenu>
                {group.items.map((item) => (
                  <DestinationLink item={item} key={item.label} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <p className="text-muted-foreground px-2 text-xs">
          Your estates, organised.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Estate pages and resident report pages show the sidebar; others are full width. */
export function hasSidebar(pathname: string, residentOnly = false): boolean {
  const estateId = pathname.match(ESTATE_PATH)?.groups?.estateId;
  return (
    (estateId !== undefined && estateId !== "new") ||
    isResidentPage(pathname, residentOnly)
  );
}
