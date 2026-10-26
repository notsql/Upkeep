import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  ClipboardList,
  ClipboardPenLine,
  Files,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useCallback, useState } from "react";
import { EstateContextSwitcher } from "@/components/estates/estate-context-switcher";
import { EstateFeatureChooser } from "@/components/estates/estate-feature-chooser";
import type { EstateFeature } from "@/components/estates/estate-feature-switcher";
import { EstateFeatureSwitcher } from "@/components/estates/estate-feature-switcher";
import { WorkOrderEstateSwitcher } from "@/components/estates/work-order-estate-switcher";
import { ReportEstateSwitcher } from "@/components/reports/report-estate-switcher";
import { useAppAccess } from "@/lib/access";
import { useEstate } from "@/lib/estates";

const ESTATE_PATH = /^\/estates\/([^/]+)/;
const REPORT_DETAIL_PATH = /^\/reports\/[^/]+/;
type Destination =
  | "/"
  | "/estates"
  | "/invitations"
  | "/account"
  | "/reports"
  | "/reports/new"
  | "/logout"
  | "/admin/users"
  | "/estates/$estateId"
  | "/estates/$estateId/assets"
  | "/estates/$estateId/reports"
  | "/estates/$estateId/work-orders"
  | "/estates/$estateId/council"
  | "/estates/$estateId/roles"
  | "/estates/$estateId/documents";
interface NavigationItem {
  active: boolean;
  chooseEstate?: EstateFeature;
  estateId?: string;
  icon: LucideIcon;
  label: string;
  search?: { estateId: string };
  to: Destination;
}

function scopedDestinations(
  estates: components["schemas"]["EstateAccessResponse"][],
  estateId: string | undefined
): NavigationItem[] {
  const entries: NavigationItem[] = [];
  for (const assignment of estates) {
    if (
      assignment.canViewManagement ||
      assignment.canViewFaultReports ||
      assignment.estateId === estateId
    ) {
      continue;
    }
    if (assignment.canViewEstateRoles) {
      const entry: NavigationItem = {
        label: `${assignment.estateName} roles`,
        to: "/estates/$estateId/roles",
        estateId: assignment.estateId,
        icon: ShieldCheck,
        active: false,
      };
      entries.push(entry);
    } else if (assignment.canViewEstateInvitations) {
      const entry: NavigationItem = {
        label: `${assignment.estateName} invitations`,
        to: "/estates/$estateId/council",
        estateId: assignment.estateId,
        icon: Users,
        active: false,
      };
      entries.push(entry);
    }
  }
  return entries;
}

function useNavigationEstate(access: ReturnType<typeof useAppAccess>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const searchEstate = useRouterState({
    select: (state) =>
      (state.location.search as { estateId?: string }).estateId,
  });
  const residentPage =
    pathname === "/reports" || pathname.startsWith("/reports/");
  let candidate = pathname.match(ESTATE_PATH)?.[1];
  if (!candidate && residentPage) {
    candidate = searchEstate;
    if (!candidate && access.data?.residentEstates.length === 1) {
      candidate = access.data.residentEstates[0]?.id;
    }
  }
  const permission = access.data?.estates.find(
    (item) => item.estateId === candidate
  );
  const allowed =
    permission?.canViewDocuments ||
    permission?.canViewManagement ||
    permission?.canViewFaultReports ||
    permission?.canViewWorkOrders ||
    permission?.canViewEstateRoles ||
    permission?.canViewEstateInvitations ||
    permission?.role === "RESIDENT";
  let estateId =
    candidate && candidate !== "new" && allowed ? candidate : undefined;
  const estate = useEstate(
    permission?.canViewManagement ? estateId : undefined
  );
  if (residentPage && access.data?.estates.length && !estateId) {
    estateId = "";
  }
  return {
    pathname,
    estateId,
    permission,
    estateName: estate.data?.name ?? permission?.estateName,
  };
}
function useNavigation() {
  const access = useAppAccess();
  const { pathname, estateId, permission, estateName } =
    useNavigationEstate(access);
  const residentSearch =
    permission?.role === "RESIDENT" && estateId ? { estateId } : undefined;
  const reporting: NavigationItem = {
    search: residentSearch,
    label: "Report a fault",
    to: "/reports/new",
    icon: ClipboardPenLine,
    active: pathname.startsWith("/reports/new"),
  };
  const invitations: NavigationItem = {
    label: "Invitations",
    to: "/invitations",
    icon: Users,
    active: pathname.startsWith("/invitations"),
  };
  const history: NavigationItem = {
    search: residentSearch,
    label: "My reports",
    to: "/reports",
    icon: ClipboardList,
    active:
      pathname === "/reports" ||
      (REPORT_DETAIL_PATH.test(pathname) &&
        !pathname.startsWith("/reports/new")),
  };
  const estates: NavigationItem = {
    label: "Estates",
    to: "/estates",
    icon: Building2,
    active:
      pathname === "/estates" ||
      pathname === "/estates/" ||
      pathname === "/estates/new" ||
      pathname === "/estates/new/",
  };
  if (!access.data || access.isError) {
    return {
      desktop: [],
      local: [],
      primary: [],
      overflow: [],
      estateId: undefined,
      estateName: undefined,
    };
  }
  if (!access.data.canEnterWorkspace) {
    const signOut: NavigationItem = {
      label: "Sign out",
      to: "/logout",
      icon: LogOut,
      active: false,
    };
    const destinations = access.data.hasResidentMembership
      ? [estates, reporting, history, invitations, signOut]
      : [estates, reporting, invitations, signOut];
    return {
      desktop: destinations,
      local: [],
      primary: destinations,
      overflow: [],
      estateId,
      estateName,
    };
  }
  const home: NavigationItem = {
    label: "Home",
    to: "/",
    icon: Home,
    active: pathname === "/",
  };
  const desktop = [home, estates, invitations];
  const primary = [
    home,
    { ...estates, active: pathname.startsWith("/estates") },
  ];
  const overflow: NavigationItem[] = [
    invitations,
    {
      label: "Settings",
      to: "/account",
      icon: UserRound,
      active: pathname.startsWith("/account"),
    },
  ];
  if (access.data.canAccessPlatformAdmin) {
    const admin: NavigationItem = {
      label: "Admin users",
      to: "/admin/users",
      icon: ShieldCheck,
      active: pathname.startsWith("/admin"),
    };
    desktop.push(admin);
    overflow.push(admin);
  }
  const scoped = scopedDestinations(access.data.estates, estateId);
  desktop.push(...scoped);
  overflow.push(...scoped);
  const local = estateDestinations(estateId, permission, pathname);
  if (
    !permission?.canViewWorkOrders &&
    access.data.estates.some((item) => item.canViewWorkOrders)
  ) {
    const entry: NavigationItem = {
      label: "Work orders",
      to: "/estates/$estateId/work-orders",
      chooseEstate: "work-orders",
      icon: Wrench,
      active: false,
    };
    desktop.push(entry);
    overflow.push(entry);
  }
  if (
    !permission?.canViewDocuments &&
    access.data.estates.some((item) => item.canViewDocuments)
  ) {
    const entry: NavigationItem = {
      label: "Documents",
      to: "/estates/$estateId/documents",
      chooseEstate: "documents",
      icon: Files,
      active: false,
    };
    desktop.push(entry);
    overflow.push(entry);
  }
  const responderEntry = reportDestination(access.data.estates, permission);
  if (responderEntry) {
    desktop.push(responderEntry);
    overflow.push(responderEntry);
  }
  if (access.data.hasResidentMembership) {
    desktop.push(reporting, history);
    overflow.push(reporting, history);
  }
  return {
    desktop,
    local,
    primary,
    overflow,
    estateId,
    estateName,
  };
}
function reportDestination(
  estates: components["schemas"]["EstateAccessResponse"][],
  permission: components["schemas"]["EstateAccessResponse"] | undefined
): NavigationItem | undefined {
  if (permission?.canViewFaultReports) {
    return;
  }
  if (!estates.some((item) => item.canViewFaultReports)) {
    return;
  }
  return {
    label: "Respond to faults",
    to: "/estates/$estateId/reports",
    chooseEstate: "reports",
    icon: ClipboardList,
    active: false,
  };
}

function estateDestinations(
  estateId: string | undefined,
  permission: components["schemas"]["EstateAccessResponse"] | undefined,
  pathname: string
): NavigationItem[] {
  const local: NavigationItem[] = [];
  if (estateId && permission) {
    const base = `/estates/${estateId}`;
    if (permission.canViewDocuments) {
      local.push({
        label: "Documents",
        to: "/estates/$estateId/documents",
        estateId,
        icon: Files,
        active: pathname.startsWith(`${base}/documents`),
      });
    }
    if (permission.canViewWorkOrders) {
      local.push({
        label: "Work orders",
        to: "/estates/$estateId/work-orders",
        estateId,
        icon: Wrench,
        active: pathname.startsWith(`${base}/work-orders`),
      });
    }
    if (permission?.canViewManagement) {
      local.push({
        label: "Overview",
        to: "/estates/$estateId",
        estateId,
        icon: LayoutDashboard,
        active: pathname === base || pathname === `${base}/`,
      });
    }
    if (permission.canViewEstateRoles) {
      local.push({
        label: "Roles",
        to: "/estates/$estateId/roles",
        estateId,
        icon: ShieldCheck,
        active: pathname.startsWith(`${base}/roles`),
      });
    }
    if (permission?.canViewFaultReports) {
      local.push({
        label: "Fault reports",
        to: "/estates/$estateId/reports",
        estateId,
        icon: ClipboardList,
        active: pathname.startsWith(`${base}/reports`),
      });
    }
    if (permission?.canViewAssets) {
      local.push({
        label: "Assets",
        to: "/estates/$estateId/assets",
        estateId,
        icon: Layers,
        active: pathname.startsWith(`${base}/assets`),
      });
    }
    if (
      permission?.canViewEstateInvitations ||
      permission?.canInviteMembers ||
      permission?.canManageInvitationPermissions
    ) {
      local.push({
        label: "Estate members",
        to: "/estates/$estateId/council",
        estateId,
        icon: Users,
        active: pathname.startsWith(`${base}/council`),
      });
    }
  }
  return local;
}
function DestinationLink({
  item,
  mobile = false,
  contextual = false,
  onChooseEstate,
}: {
  item: NavigationItem;
  mobile?: boolean;
  contextual?: boolean;
  onChooseEstate?: (feature: EstateFeature) => void;
}) {
  const selectEstate = useCallback(() => {
    if (item.chooseEstate) {
      onChooseEstate?.(item.chooseEstate);
    }
  }, [item.chooseEstate, onChooseEstate]);
  const Icon = item.icon;
  let linkClass = "sidebar-link";
  if (mobile) {
    linkClass = "bottom-nav-link";
  }
  if (contextual) {
    linkClass = "estate-nav-link";
  }
  if (item.chooseEstate) {
    return (
      <Button
        aria-haspopup="dialog"
        className={`${linkClass} h-auto w-full justify-start gap-3 rounded-xl border-0 px-3 py-3 text-left`}
        onClick={selectEstate}
        type="button"
        variant="ghost"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span>{item.label}</span>
      </Button>
    );
  }
  return (
    <Link
      activeOptions={{ exact: true, includeSearch: false }}
      aria-current={item.active ? "page" : undefined}
      className={linkClass}
      params={item.estateId ? { estateId: item.estateId } : undefined}
      search={item.search}
      to={item.to}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
function OverflowNavigation({
  items,
  onChooseEstate,
}: {
  items: NavigationItem[];
  onChooseEstate: (feature: EstateFeature) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="More navigation"
            className="bottom-nav-link h-auto rounded-none"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
        <span>More</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48 rounded-xl p-2"
        side="top"
        sideOffset={12}
      >
        {items.map((item) => (
          <OverflowDestination
            item={item}
            key={item.label}
            onChooseEstate={onChooseEstate}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OverflowDestination({
  item,
  onChooseEstate,
}: {
  item: NavigationItem;
  onChooseEstate: (feature: EstateFeature) => void;
}) {
  const choose = useCallback(() => {
    if (item.chooseEstate) {
      onChooseEstate(item.chooseEstate);
    }
  }, [item.chooseEstate, onChooseEstate]);
  if (item.chooseEstate) {
    return <DropdownMenuItem onClick={choose}>{item.label}</DropdownMenuItem>;
  }
  return (
    <DropdownMenuItem
      render={
        <Link
          activeOptions={{
            exact: true,
            includeSearch: false,
          }}
          aria-current={item.active ? "page" : undefined}
          params={item.estateId ? { estateId: item.estateId } : undefined}
          search={item.search}
          to={item.to}
        />
      }
    >
      {item.label}
    </DropdownMenuItem>
  );
}

function NavigationEstateSwitcher({
  estateId,
  estateName,
}: {
  estateId: string;
  estateName?: string;
}) {
  const access = useAppAccess();
  const reporting = useRouterState({
    select: (state) => state.location.pathname.split("/")[3] === "reports",
  });
  const workOrders = useRouterState({
    select: (state) => state.location.pathname.split("/")[3] === "work-orders",
  });
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const documents = useRouterState({
    select: (state) => state.location.pathname.split("/")[3] === "documents",
  });
  const creatingReport = useRouterState({
    select: (state) => state.location.pathname.startsWith("/reports/new"),
  });
  if (documents) {
    return (
      <EstateFeatureSwitcher
        estateId={estateId}
        estates={access.data?.estates ?? []}
        feature="documents"
      />
    );
  }
  if (permission?.role === "RESIDENT" || !estateId) {
    return (
      <EstateFeatureSwitcher
        estateId={estateId}
        estates={access.data?.estates ?? []}
        feature={creatingReport ? "report-creation" : "resident"}
      />
    );
  }
  if (workOrders) {
    return (
      <WorkOrderEstateSwitcher
        estateId={estateId}
        estates={access.data?.estates ?? []}
      />
    );
  }
  if (permission?.canViewManagement && !reporting) {
    return (
      <EstateContextSwitcher estateId={estateId} estateName={estateName} />
    );
  }
  if (!permission?.canViewFaultReports) {
    return (
      <EstateFeatureSwitcher
        estateId={estateId}
        estates={access.data?.estates ?? []}
        feature="management"
      />
    );
  }
  return (
    <ReportEstateSwitcher
      estateId={estateId}
      estates={access.data?.estates ?? []}
    />
  );
}
export function AppNavigation() {
  const [chooserFeature, setChooserFeature] = useState<
    EstateFeature | undefined
  >(undefined);
  const chooseEstate = useCallback(
    (feature: EstateFeature) => setChooserFeature(feature),
    []
  );
  const changeChooser = useCallback((open: boolean) => {
    if (!open) {
      setChooserFeature(undefined);
    }
  }, []);
  const { desktop, local, primary, overflow, estateId, estateName } =
    useNavigation();
  return (
    <>
      <aside className="app-sidebar">
        <Link className="brand-mark" to="/">
          <Building2 aria-hidden="true" className="size-6" />
          <span>UpKeep</span>
        </Link>
        <p className="sidebar-eyebrow">Workspace</p>
        <nav
          aria-label="Desktop navigation"
          className="grid min-w-0 grid-cols-1 gap-1"
        >
          {desktop.map((item) => (
            <DestinationLink
              item={item}
              key={item.label}
              onChooseEstate={chooseEstate}
            />
          ))}
          {estateId === undefined ? null : (
            <>
              <div className="mt-6 mb-2 min-w-0">
                <NavigationEstateSwitcher
                  estateId={estateId}
                  estateName={estateName}
                />
              </div>
              {local.map((item) => (
                <DestinationLink item={item} key={item.label} />
              ))}
            </>
          )}
        </nav>
        <p className="mt-auto px-3 pt-8 text-muted-foreground text-xs">
          Your estates, organised.
        </p>
      </aside>
      <nav aria-label="Mobile navigation" className="mobile-app-bar">
        {primary.map((item) => (
          <DestinationLink item={item} key={item.label} mobile />
        ))}
        {overflow.length ? (
          <OverflowNavigation items={overflow} onChooseEstate={chooseEstate} />
        ) : null}
      </nav>
      <EstateFeatureChooser
        feature={chooserFeature ?? "work-orders"}
        onOpenChange={changeChooser}
        open={!!chooserFeature}
      />
    </>
  );
}

export function EstateNavigation() {
  const { local, estateId, estateName } = useNavigation();
  if (estateId === undefined) {
    return null;
  }
  return (
    <nav aria-label="Estate navigation" className="estate-navigation">
      <NavigationEstateSwitcher estateId={estateId} estateName={estateName} />
      <div className="flex flex-wrap gap-2">
        {local.map((item) => (
          <DestinationLink contextual item={item} key={item.label} />
        ))}
      </div>
    </nav>
  );
}
