import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@proj/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import type { NavigationItem } from "@/components/shell/navigation-item";

export function DestinationLink({ item }: { item: NavigationItem }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobile = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const Icon = item.icon;
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
