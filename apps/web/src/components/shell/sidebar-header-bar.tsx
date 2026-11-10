import { useSidebar } from "@proj/ui/components/sidebar";
import Header from "@/components/shell/header";

/** The sidebar shows the brand on desktop; on mobile (bottom bar, no sidebar) the header shows it. */
export function SidebarHeaderBar() {
  const { isMobile } = useSidebar();
  return <Header brand={isMobile} />;
}
