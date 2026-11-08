import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Wrench,
} from "lucide-react";
import { SectionCard } from "@/components/page/section-card";
import { LoadingState } from "@/components/states/loading-state";
import { localToday } from "@/lib/assessments";
import { useAssetEvents } from "@/lib/asset-events";
import { formatDate } from "@/lib/format";
import { useInspectionList } from "@/lib/inspection-list";
import { useAssetServiceInterval } from "@/lib/service-intervals";
import {
  inspectionItems,
  relativeDue,
  serviceItem,
  type UpcomingItem,
  type UpcomingKind,
  type UpcomingTone,
  upcomingTone,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-upcoming/upcoming-items";

const ICONS = {
  inspection: ClipboardList,
  service: Wrench,
} as const satisfies Record<UpcomingKind, unknown>;

const TONE_TEXT: Record<UpcomingTone, string> = {
  overdue: "text-destructive",
  soon: "text-amber-700 dark:text-amber-300",
  later: "text-muted-foreground",
};

function UpcomingRow({
  item,
  today,
  estateId,
  assetId,
}: {
  item: UpcomingItem;
  today: string;
  estateId: string;
  assetId: string;
}) {
  const tone = upcomingTone(item.dueOn, today);
  const Icon = ICONS[item.kind];
  return (
    <li data-tone={tone}>
      <Link
        className="hover:bg-muted/50 focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-3"
        params={{ estateId, assetId }}
        to="/estates/$estateId/assets/$assetId/records"
      >
        <Icon
          aria-hidden="true"
          className={cn("size-4 shrink-0", TONE_TEXT[tone])}
        />
        <span className="min-w-0 flex-1 font-medium" data-title>
          {item.title}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDate(item.dueOn)}
        </span>
        <span
          className={cn("w-28 text-right text-xs font-medium", TONE_TEXT[tone])}
        >
          {relativeDue(item.dueOn, today)}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
      </Link>
    </li>
  );
}

/**
 * Work coming up for this asset, soonest first. Each source loads only for
 * viewers its endpoint serves: the inspection list for owners and delegates,
 * the service interval for those who see the Service interval card.
 */
export function AssetUpcoming({
  estateId,
  assetId,
  installedOn,
  canSeeInspections,
  canSeeService,
  className,
}: {
  estateId: string;
  assetId: string;
  installedOn: string | null | undefined;
  canSeeInspections: boolean;
  canSeeService: boolean;
  className?: string;
}) {
  const list = useInspectionList(estateId, canSeeInspections);
  const events = useAssetEvents(estateId, assetId, canSeeService);
  const interval = useAssetServiceInterval(estateId, assetId, canSeeService);
  const pending =
    (canSeeInspections && list.isPending) ||
    (canSeeService && (events.isPending || interval.isPending));
  const failed = list.isError || events.isError || interval.isError;
  const today = localToday();
  const service = serviceItem(
    events.data ?? [],
    interval.data?.effective,
    installedOn
  );
  const items = [
    ...inspectionItems(list.data?.checks ?? [], assetId),
    ...(service ? [service] : []),
  ].sort((a, b) => a.dueOn.localeCompare(b.dueOn));

  return (
    <SectionCard className={className} icon={CalendarClock} title="Upcoming">
      {pending && !failed ? (
        <LoadingState label="Loading upcoming work…" rows={2} />
      ) : null}
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          Some upcoming work could not be loaded.
        </p>
      ) : null}
      {!pending && items.length ? (
        <ul aria-label="Upcoming" className="divide-y text-sm">
          {items.map((item) => (
            <UpcomingRow
              assetId={assetId}
              estateId={estateId}
              item={item}
              key={item.id}
              today={today}
            />
          ))}
        </ul>
      ) : null}
      {pending || failed || items.length ? null : (
        <p className="text-muted-foreground text-sm">Nothing scheduled</p>
      )}
    </SectionCard>
  );
}
