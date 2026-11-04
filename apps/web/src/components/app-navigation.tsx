import type { components } from "@proj/api/schema";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@proj/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@proj/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  ClipboardList,
  Files,
  Home,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useCallback, useState } from "react";
import { EstateSectionMenu } from "@/components/estate-section-menu";
import { EstateContextSwitcher } from "@/components/estates/estate-context-switcher";
import { EstateFeatureChooser } from "@/components/estates/estate-feature-chooser";
import type { EstateFeature } from "@/components/estates/estate-feature-switcher";
import { EstateFeatureSwitcher } from "@/components/estates/estate-feature-switcher";
import { residentNavigation } from "@/components/estates/resident-navigation";
import { WorkOrderEstateSwitcher } from "@/components/estates/work-order-estate-switcher";
import { ReportEstateSwitcher } from "@/components/reports/report-estate-switcher";
import { useAppAccess } from "@/lib/access";
import { useEstate } from "@/lib/estates";
import { useMobile } from "@/lib/use-mobile";

const ESTATE_PATH = /^\/estates\/(?<estateId>[^/]+)/u;
type Destination =
  | "/"
  | "/estates"
  | "/account"
  | "/reports"
  | "/reports/new"
  | "/admin/users"
  | "/estates/$estateId"
  | "/estates/$estateId/assets"
  | "/estates/$estateId/reports"
  | "/estates/$estateId/work-orders"
  | "/estates/$estateId/council"
  | "/estates/$estateId/roles"
  | "/estates/$estateId/readings"
  | "/estates/$estateId/documents";
export interface NavigationItem {
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
  let candidate = pathname.match(ESTATE_PATH)?.groups?.estateId;
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
    permission?.canViewReadings ||
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
      items: [],
      local: [],
      estateId: undefined,
      estateName: undefined,
    };
  }
  const resident = residentNavigation(access.data, estateId, pathname);
  const local = [
    ...estateDestinations(estateId, permission, pathname),
    ...resident.local,
  ];
  if (!access.data.canEnterWorkspace) {
    const destinations = [estates, ...resident.global];
    return {
      items: destinations,
      local,
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
  const items: NavigationItem[] = [
    home,
    estates,
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
    items.push(admin);
  }
  const scoped = scopedDestinations(access.data.estates, estateId);
  items.push(...scoped);
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
    items.push(entry);
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
    items.push(entry);
  }
  const responderEntry = reportDestination(access.data.estates, permission);
  if (responderEntry) {
    items.push(responderEntry);
  }
  items.push(...resident.global);
  return {
    items,
    local,
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
  if (!(estateId && permission)) {
    return local;
  }
  const base = `/estates/${estateId}`;
  if (permission?.canViewEstateDetails ?? permission?.canViewManagement) {
    local.push({
      label: "Overview",
      to: "/estates/$estateId",
      estateId,
      icon: LayoutDashboard,
      active: pathname === base || pathname === `${base}/`,
    });
  }
  if (permission?.canViewAssets || permission?.canViewInspectionResults) {
    local.push({
      label: "Assets",
      to: "/estates/$estateId/assets",
      estateId,
      icon: Layers,
      active: pathname.startsWith(`${base}/assets`),
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
  if (permission?.canViewFaultReports) {
    local.push({
      label: "Fault reports",
      to: "/estates/$estateId/reports",
      estateId,
      icon: ClipboardList,
      active: pathname.startsWith(`${base}/reports`),
    });
  }
  if (permission.canViewReadings) {
    local.push({
      label: "Readings",
      to: "/estates/$estateId/readings",
      estateId,
      icon: Activity,
      active: pathname.startsWith(`${base}/readings`),
    });
  }
  if (permission.canViewDocuments) {
    local.push({
      label: "Documents",
      to: "/estates/$estateId/documents",
      estateId,
      icon: Files,
      active: pathname.startsWith(`${base}/documents`),
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
  if (permission.canViewEstateRoles) {
    local.push({
      label: "Roles",
      to: "/estates/$estateId/roles",
      estateId,
      icon: ShieldCheck,
      active: pathname.startsWith(`${base}/roles`),
    });
  }
  return local;
}
function DestinationLink({
  item,
  onChooseEstate,
}: {
  item: NavigationItem;
  onChooseEstate?: (feature: EstateFeature) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobile = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const selectEstate = useCallback(() => {
    closeMobile();
    if (item.chooseEstate) {
      onChooseEstate?.(item.chooseEstate);
    }
  }, [closeMobile, item.chooseEstate, onChooseEstate]);
  const Icon = item.icon;
  if (item.chooseEstate) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-haspopup="dialog"
          onClick={selectEstate}
          type="button"
        >
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={item.active}
        render={
          <Link
            activeOptions={{ exact: true, includeSearch: false }}
            aria-current={item.active ? "page" : undefined}
            onClick={closeMobile}
            params={item.estateId ? { estateId: item.estateId } : undefined}
            search={item.search}
            to={item.to}
          />
        }
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
  const readings = useRouterState({
    select: (state) => state.location.pathname.split("/")[3] === "readings",
  });
  const creatingReport = useRouterState({
    select: (state) => state.location.pathname.startsWith("/reports/new"),
  });
  if (documents || readings) {
    return (
      <EstateFeatureSwitcher
        estateId={estateId}
        estates={access.data?.estates ?? []}
        feature={readings ? "readings" : "documents"}
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
  if (
    (permission?.canViewEstateDetails ?? permission?.canViewManagement) &&
    !reporting
  ) {
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
  const { items, local, estateId, estateName } = useNavigation();
  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/" />} size="lg">
                <Building2 aria-hidden="true" />
                <span className="text-base font-semibold">UpKeep</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Workspace navigation">
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => (
                  <DestinationLink
                    item={item}
                    key={item.label}
                    onChooseEstate={chooseEstate}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroup>
            {estateId === undefined ? null : (
              <SidebarGroup>
                <div className="min-w-0 pb-2">
                  <NavigationEstateSwitcher
                    estateId={estateId}
                    estateName={estateName}
                  />
                </div>
                <SidebarMenu>
                  {local.map((item) => (
                    <DestinationLink item={item} key={item.label} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <p className="text-muted-foreground px-2 text-xs">
            Your estates, organised.
          </p>
        </SidebarFooter>
      </Sidebar>
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
  const mobile = useMobile();
  if (!mobile || estateId === undefined) {
    return null;
  }
  return (
    <nav
      aria-label="Estate navigation"
      className="mx-auto grid max-w-6xl gap-2 border-b px-4 py-2 sm:px-6 md:hidden"
    >
      <NavigationEstateSwitcher estateId={estateId} estateName={estateName} />
      <EstateSectionMenu items={local} key={estateId} />
    </nav>
  );
}

/** Only pages inside one estate show the sidebar; every other page is full width. */
export function isEstateScoped(pathname: string): boolean {
  const estateId = pathname.match(ESTATE_PATH)?.groups?.estateId;
  return estateId !== undefined && estateId !== "new";
}

function ChooserMenuItem({
  feature,
  item,
  onChooseEstate,
}: {
  feature: EstateFeature;
  item: NavigationItem;
  onChooseEstate: (feature: EstateFeature) => void;
}) {
  const choose = useCallback(
    () => onChooseEstate(feature),
    [feature, onChooseEstate]
  );
  const Icon = item.icon;
  return (
    <DropdownMenuItem
      aria-haspopup="dialog"
      className="min-h-11 text-sm"
      onClick={choose}
    >
      <Icon aria-hidden="true" />
      {item.label}
    </DropdownMenuItem>
  );
}

/**
 * The sidebar's global links as account-menu items, for pages without a
 * sidebar. Settings is already in the account menu, so it is left out. Items
 * that need an estate first call `onChooseEstate`, so the caller can open the
 * estate chooser outside the menu (which closes on selection).
 */
export function WorkspaceMenuItems({
  onChooseEstate,
}: {
  onChooseEstate: (feature: EstateFeature) => void;
}) {
  const { items } = useNavigation();
  const links = items.filter((item) => item.to !== "/account");
  if (links.length === 0) {
    return null;
  }
  return (
    <>
      {links.map((item) => {
        const Icon = item.icon;
        if (item.chooseEstate) {
          return (
            <ChooserMenuItem
              feature={item.chooseEstate}
              item={item}
              key={item.label}
              onChooseEstate={onChooseEstate}
            />
          );
        }
        return (
          <DropdownMenuItem
            className="min-h-11 text-sm"
            key={item.label}
            render={
              <Link
                aria-current={item.active ? "page" : undefined}
                params={item.estateId ? { estateId: item.estateId } : undefined}
                search={item.search}
                to={item.to}
              />
            }
          >
            <Icon aria-hidden="true" />
            {item.label}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
    </>
  );
}
