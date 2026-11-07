import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEstateFailureRisk } from "@/lib/failure-risk";
import {
  footerLink,
  RECENT,
} from "@/routes/_auth/estates/$estateId/-components/estate-details-page/dashboard-lists";
import { ListCard } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/list-card";

export function FlaggedAssets({ estateId }: { estateId: string }) {
  const risk = useEstateFailureRisk(estateId);
  const flagged = (risk.data ?? [])
    .filter((item) => item.flagged)
    .slice(0, RECENT);
  return (
    <ListCard
      description="Assets needing attention"
      empty={flagged.length === 0}
      footer={
        <Link
          className={footerLink}
          params={{ estateId }}
          to="/estates/$estateId/failure-risk"
        >
          Failure risk
        </Link>
      }
      icon={Flag}
      title="At-risk assets"
    >
      {flagged.map((item) => (
        <li className="py-2 first:pt-0" key={item.assetId}>
          <Link
            className="block"
            params={{ estateId, assetId: item.assetId }}
            to="/estates/$estateId/assets/$assetId"
          >
            <span className="block font-medium">{item.assetReference}</span>
            <span className="text-muted-foreground block truncate text-sm">
              {item.assetName}
            </span>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}
