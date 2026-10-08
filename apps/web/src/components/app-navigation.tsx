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
  const { pathname } = useRouterState({
    select: (state) => state.location,
  });
  const candidate = pathname.match(ESTATE_PATH)?.[1];
  const estateId = candidate && candidate !== "new" ? candidate : undefined;
  const estate = useEstate(estateId);
  const global: NavigationItem[] = [
    { label: "Home", to: "/", icon: Home, active: pathname === "/" },
    {
      label: "Estates",
      to: "/estates",
      icon: Building2,
      active:
        pathname === "/estates" ||
        pathname === "/estates/" ||
        pathname === "/estates/new",
    },
    {
      label: "Account",
      to: "/account",
      icon: UserRound,
      active: pathname.startsWith("/account"),
    },
  ];
  if (role === "admin") {
    global.push({
      label: "Admin users",
      to: "/admin/users",
      icon: ShieldCheck,
      active: pathname.startsWith("/admin"),
    });
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
  const primary = estateId
    ? [global[1], ...local]
    : global.filter((item) => item.label !== "Admin users");
  const overflow = estateId
    ? global.filter((item) => item.label !== "Estates")
    : global.filter((item) => item.label === "Admin users");
  return { global, local, primary, overflow, estateName: estate.data?.name };
}
function DestinationLink({
  item,
  mobile = false,
}: {
  item: NavigationItem;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      activeOptions={{ exact: true, includeSearch: false }}
      aria-current={item.active ? "page" : undefined}
      className={mobile ? "bottom-nav-link" : "sidebar-link"}
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
  const { global, local, primary, overflow, estateName } = useNavigation();
  return (
    <>
      <aside className="app-sidebar">
        <Link className="brand-mark" to="/">
          <Building2 aria-hidden="true" className="size-6" />
          <span>UpKeep</span>
        </Link>
        <p className="sidebar-eyebrow">Workspace</p>
        <nav aria-label="Desktop navigation" className="grid gap-1">
          {global
            .filter((item) => item.to !== "/account")
            .map((item) => (
              <DestinationLink item={item} key={item.label} />
            ))}
          {local.length ? (
            <>
              <p className="sidebar-eyebrow mt-6 break-words">
                {estateName ?? "Current estate"}
              </p>
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
