import { tabsListVariants } from "@proj/ui/components/tabs";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Layers, type LucideIcon, Settings, Wrench } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import {
  type NavigationGroup,
  useNavigationGroups,
} from "@/components/shell/app-navigation";
import type { NavigationItem } from "@/components/shell/navigation-item";

interface MobileSection {
  icon: LucideIcon;
  items: NavigationItem[];
  label: string;
}

const SECTION_ICONS: Record<string, LucideIcon> = {
  Maintenance: Wrench,
  Assets: Layers,
  Administration: Settings,
};
const SHORT_LABELS: Record<string, string> = { Administration: "Admin" };

/**
 * The sidebar groups as bottom-bar sections: each ungrouped item (Overview,
 * or a resident's pages) is its own one-page section; each labelled group is
 * a section of its items.
 */
function mobileSections(groups: NavigationGroup[]): MobileSection[] {
  return groups.flatMap((group): MobileSection[] => {
    if (!group.label) {
      return group.items.map((item) => ({
        icon: item.icon,
        items: [item],
        label: item.label,
      }));
    }
    return [
      {
        icon: SECTION_ICONS[group.label] ?? group.items[0]?.icon ?? Layers,
        items: group.items,
        label: SHORT_LABELS[group.label] ?? group.label,
      },
    ];
  });
}

function ItemLink({
  item,
  active,
  className,
  children,
}: {
  item: NavigationItem;
  active: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      activeOptions={{ exact: true, includeSearch: false }}
      aria-current={active ? "page" : undefined}
      className={className}
      data-active={active ? "" : undefined}
      params={item.estateId ? { estateId: item.estateId } : undefined}
      search={item.search}
      to={item.to}
    >
      {children}
    </Link>
  );
}

function SectionTabs({ section }: { section: MobileSection }) {
  const active = useRef<HTMLSpanElement>(null);
  const activeLabel = section.items.find((item) => item.active)?.label;
  useEffect(() => {
    if (activeLabel) {
      active.current?.scrollIntoView?.({ block: "nearest", inline: "center" });
    }
  }, [activeLabel]);
  return (
    <nav
      aria-label="Section pages"
      className="overflow-x-auto px-2 pt-1.5 pb-1.5"
    >
      <div
        className={cn(
          tabsListVariants({ variant: "default" }),
          "flex h-9 w-full min-w-max bg-transparent p-0"
        )}
        data-variant="default"
      >
        {section.items.map((item) => {
          const Icon = item.icon;
          return (
            <span
              className="flex h-full flex-1"
              key={item.label}
              ref={item.active ? active : undefined}
            >
              <ItemLink
                active={item.active}
                className="text-foreground/60 hover:text-foreground focus-visible:ring-ring/50 data-active:bg-background data-active:text-foreground dark:text-muted-foreground dark:data-active:border-input dark:data-active:bg-input/30 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] data-active:shadow-sm [&_svg]:size-4 [&_svg]:shrink-0"
                item={item}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </ItemLink>
            </span>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile estate navigation: section tabs above a fixed bar of sections. */
export function BottomNavigation() {
  const sections = mobileSections(useNavigationGroups());
  const current = sections.find((section) =>
    section.items.some((item) => item.active)
  );
  return (
    <div className="bg-muted fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)]">
      {current && current.items.length > 1 ? (
        <SectionTabs section={current} />
      ) : null}
      <nav aria-label="Estate sections">
        <ul className="flex">
          {sections.map((section) => {
            const Icon = section.icon;
            const [first] = section.items;
            if (!first) {
              return null;
            }
            return (
              <li className="flex-1" key={section.label}>
                <ItemLink
                  active={section === current}
                  className="text-muted-foreground data-active:text-primary focus-visible:ring-ring/50 flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium outline-none focus-visible:ring-[3px] [&_svg]:size-5"
                  item={first}
                >
                  <Icon aria-hidden="true" />
                  {section.label}
                </ItemLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
