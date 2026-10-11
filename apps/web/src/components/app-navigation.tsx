import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import {
  Building2,
  Home,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { EstateContextSwitcher } from "@/components/estates/estate-context-switcher";
import { useEstate } from "@/lib/estates";

const ESTATE_PATH = /^\/estates\/([^/]+)/;
type Destination =
  | "/"
  | "/estates"
  | "/account"
  | "/admin/users"
  | "/estates/$estateId"
  | "/estates/$estateId/assets"
  | "/estates/$estateId/council";
interface NavigationItem {
  active: boolean;
  estateId?: string;
  icon: LucideIcon;
  label: string;
  to: Destination;
}

function useNavigation() {
  const { role } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const candidate = pathname.match(ESTATE_PATH)?.[1];
  const estateId = candidate && candidate !== "new" ? candidate : undefined;
  const estate = useEstate(estateId);
  const home: NavigationItem = {
    label: "Home",
    to: "/",
    icon: Home,
    active: pathname === "/",
  };
  const estates: NavigationItem = {
    label: "Estates",
    to: "/estates",
    icon: Building2,
    active:
      pathname === "/estates" ||
      pathname === "/estates/" ||
      pathname === "/estates/new",
  };
  const desktop = [home, estates];
  const primary = [
    home,
    { ...estates, active: pathname.startsWith("/estates") },
  ];
  const overflow: NavigationItem[] = [
    {
      label: "Settings",
      to: "/account",
      icon: UserRound,
      active: pathname.startsWith("/account"),
    },
  ];
  if (role === "admin") {
    const admin: NavigationItem = {
      label: "Admin users",
      to: "/admin/users",
      icon: ShieldCheck,
      active: pathname.startsWith("/admin"),
    };
    desktop.push(admin);
    overflow.push(admin);
  }
  const local: NavigationItem[] = [];
  if (estateId) {
    const base = `/estates/${estateId}`;
    local.push({
      label: "Overview",
      to: "/estates/$estateId",
      estateId,
      icon: LayoutDashboard,
      active: pathname === base || pathname === `${base}/`,
    });
    if (estate.data?.owned) {
      local.push({
        label: "Assets",
        to: "/estates/$estateId/assets",
        estateId,
        icon: Layers,
        active: pathname.startsWith(`${base}/assets`),
      });
    }
    if (
      estate.data?.canInviteMembers ||
      estate.data?.canManageInvitationPermissions
    ) {
      local.push({
        label: "Council",
        to: "/estates/$estateId/council",
        estateId,
        icon: Users,
        active: pathname.startsWith(`${base}/council`),
      });
    }
  }
  return {
    desktop,
    local,
    primary,
    overflow,
    estateId,
    estateName: estate.data?.name,
  };
}
function DestinationLink({
  item,
  mobile = false,
  contextual = false,
}: {
  item: NavigationItem;
  mobile?: boolean;
  contextual?: boolean;
}) {
  const Icon = item.icon;
  let linkClass = "sidebar-link";
  if (mobile) {
    linkClass = "bottom-nav-link";
  }
  if (contextual) {
    linkClass = "estate-nav-link";
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
function OverflowNavigation({ items }: { items: NavigationItem[] }) {
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
          <DropdownMenuItem
            key={item.label}
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
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function AppNavigation() {
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
            <DestinationLink item={item} key={item.label} />
          ))}
          {estateId ? (
            <>
              <div className="mt-6 mb-2">
                <EstateContextSwitcher
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
        {overflow.length ? <OverflowNavigation items={overflow} /> : null}
      </nav>
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
      <EstateContextSwitcher estateId={estateId} estateName={estateName} />
      <div className="flex flex-wrap gap-2">
        {local.map((item) => (
          <DestinationLink contextual item={item} key={item.label} />
        ))}
      </div>
    </nav>
  );
}
