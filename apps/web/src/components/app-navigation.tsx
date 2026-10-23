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
  | "/estates/$estateId/council";
interface NavigationItem {
  active: boolean;
  chooseEstate?: EstateFeature;
  estateId?: string;
  icon: LucideIcon;
  label: string;
  to: Destination;
}

function useNavigation() {
  const access = useAppAccess();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const candidate = pathname.match(ESTATE_PATH)?.[1];
  const permission = access.data?.estates.find(
    (item) => item.estateId === candidate
  );
  const estateId =
    candidate &&
    candidate !== "new" &&
    (permission?.canViewManagement ||
      permission?.canViewFaultReports ||
      permission?.canViewWorkOrders)
      ? candidate
      : undefined;
  const estate = useEstate(
    permission?.canViewManagement ? estateId : undefined
  );
  const reporting: NavigationItem = {
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
      estateId: undefined,
      estateName: undefined,
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
    estateName: estate.data?.name ?? permission?.estateName,
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
        <nav aria-label="Desktop navigation" className="grid gap-1">
          {desktop.map((item) => (
            <DestinationLink
              item={item}
              key={item.label}
              onChooseEstate={chooseEstate}
            />
          ))}
          {estateId ? (
            <>
              <div className="mt-6 mb-2">
                <NavigationEstateSwitcher
                  estateId={estateId}
                  estateName={estateName}
                />
              </div>
              {local.map((item) => (
                <DestinationLink item={item} key={item.label} />
              ))}
            </>
          ) : null}
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
  if (!estateId) {
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
