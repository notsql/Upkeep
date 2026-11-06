import { SidebarTrigger, useSidebar } from "@proj/ui/components/sidebar";
import Header from "@/components/shell/header";

/** The sidebar stays open on desktop; only the mobile sheet needs a trigger and the brand. */
export function SidebarHeaderBar() {
  const { isMobile } = useSidebar();
  return (
    <Header brand={isMobile} start={isMobile ? <SidebarTrigger /> : null} />
  );
}
