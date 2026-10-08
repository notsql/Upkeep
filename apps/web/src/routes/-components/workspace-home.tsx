import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Layers,
  type LucideIcon,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { usePendingCouncilInvitations } from "@/lib/council-invitations";
import { type DashboardSummary, useDashboardSummary } from "@/lib/dashboard";
import { AssetConditionDistribution } from "@/routes/-components/asset-condition-distribution";

function StatisticCard({
  label,
  value,
  description,
  icon: Icon,
  href,
  to,
  onClick,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  href?: string;
  to?: "/estates";
  onClick?: () => void;
}) {
  const card = (
    <Card aria-label={label} className="h-full gap-3" role="region">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>
          <h2 className="text-sm">{label}</h2>
        </CardTitle>
        <Icon
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </CardHeader>
      <CardContent>
        <p className="font-semibold text-3xl tabular-nums">{value}</p>
        <p className="mt-2 text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
  const linkClass =
    "block rounded-xl outline-none transition-shadow hover:ring-1 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  if (to) {
    return (
      <Link aria-label={label} className={linkClass} to={to}>
        {card}
      </Link>
    );
  }
  if (href) {
    return (
      <a aria-label={label} className={linkClass} href={href} onClick={onClick}>
        {card}
      </a>
    );
  }
  return card;
}

function PortfolioSummary({ summary }: { summary: DashboardSummary }) {
  const hasAssetScope = summary.activeOwnedEstateCount > 0;
  const conditions = summary.conditionCounts;
  const attention = conditions.needsAttention + conditions.faulty;
  const focusAttention = useCallback(
    () =>
      document
        .getElementById("attention-estates")
        ?.focus({ preventScroll: true }),
    []
  );
  const scope = `${summary.activeOwnedEstateCount} active ${summary.activeOwnedEstateCount === 1 ? "estate" : "estates"} you own`;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatisticCard
          description={`Owned and shared · ${summary.activeEstateCount} active · ${summary.inactiveEstateCount} inactive`}
          icon={Building2}
          label="Accessible estates"
          to="/estates"
          value={summary.accessibleEstateCount}
        />
        <StatisticCard
          description={`Across ${scope}`}
          icon={Layers}
          label="Active assets"
          value={hasAssetScope ? summary.totalActiveAssets : "—"}
        />
        <StatisticCard
          description={`Needs attention or faulty · ${scope}`}
          href={hasAssetScope ? "#attention-estates" : undefined}
          icon={TriangleAlert}
          label="Attention needed"
          onClick={focusAttention}
          value={hasAssetScope ? attention : "—"}
        />
        <StatisticCard
          description={`Unique accepted members, excluding you · ${scope}`}
          icon={Users}
          label="Council members"
          value={hasAssetScope ? summary.councilMemberCount : "—"}
        />
      </div>
      <p className="text-muted-foreground text-sm">
        {hasAssetScope
          ? `Asset and member summaries cover ${scope}.`
          : "Asset and member summaries are available for active estates you own."}
      </p>
      {summary.accessibleEstateCount === 0 ? (
        <p className="section-surface text-muted-foreground">
          No estates yet. Browse Estates to create an estate or review your
          invitations.
        </p>
      ) : null}
      {hasAssetScope ? (
        <>
          <section
            aria-labelledby="asset-conditions"
            className="section-surface"
          >
            <h2 className="section-heading" id="asset-conditions">
              Asset conditions
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Latest assessment for each active asset. Not assessed does not
              mean Good.
            </p>
            <AssetConditionDistribution counts={conditions} />
          </section>
          <section
            aria-labelledby="attention-estates"
            className="section-surface"
          >
            <h2
              className="section-heading scroll-mt-24 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="attention-estates"
              tabIndex={-1}
            >
              Estates needing attention
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Ordered by active assets needing attention or marked faulty.
            </p>
            {summary.affectedEstateCount === 0 ? (
              <p className="mt-4 text-sm">
                No assessed active assets need attention.
                {conditions.unassessed > 0
                  ? " Some assets still need an assessment."
                  : ""}
              </p>
            ) : null}
            {summary.affectedEstateCount >
            summary.estatesNeedingAttention.length ? (
              <p className="mt-3 text-muted-foreground text-sm">
                Showing {summary.estatesNeedingAttention.length} of{" "}
                {summary.affectedEstateCount} estates needing attention.
              </p>
            ) : null}
            <ul className="mt-3 grid gap-3">
              {summary.estatesNeedingAttention.map((estate) => (
                <li className="rounded-xl border p-4" key={estate.estateId}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="break-words font-semibold">
                        <Link
                          aria-label={`View active assets in ${estate.estateName}`}
                          className="rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          params={{ estateId: estate.estateId }}
                          search={{ status: "ACTIVE" }}
                          to="/estates/$estateId/assets"
                        >
                          {estate.estateName}
                        </Link>
                      </h3>
                      <p className="mt-1 text-muted-foreground text-sm">
                        {estate.estateCode} · {estate.totalActiveAssets} active
                        assets
                      </p>
                    </div>
                    <p className="text-sm">
                      {estate.needsAttentionCount} needs attention ·{" "}
                      {estate.faultyCount} faulty
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {estate.faultyCount > 0 ? (
                      <Link
                        aria-label={`Review faulty assets in ${estate.estateName}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                        params={{ estateId: estate.estateId }}
                        search={{ condition: "FAULTY", status: "ACTIVE" }}
                        to="/estates/$estateId/assets"
                      >
                        Review faulty
                      </Link>
                    ) : null}
                    {estate.needsAttentionCount > 0 ? (
                      <Link
                        aria-label={`Review needs-attention assets in ${estate.estateName}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                        params={{ estateId: estate.estateId }}
                        search={{
                          condition: "NEEDS_ATTENTION",
                          status: "ACTIVE",
                        }}
                        to="/estates/$estateId/assets"
                      >
                        Review needs attention
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  );
}

export function WorkspaceHome() {
  const summary = useDashboardSummary();
  const invitations = usePendingCouncilInvitations();
  const retrySummary = useCallback(() => summary.refetch(), [summary.refetch]);
  const retryInvitations = useCallback(
    () => invitations.refetch(),
    [invitations.refetch]
  );
  return (
    <main className="page-layout space-y-5">
      <PageHeader
        description="See your portfolio and prioritise assets that need attention."
        title="Portfolio overview"
      />
      {summary.isPending ? (
        <p role="status">Loading portfolio summary…</p>
      ) : null}
      {summary.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {summary.error.message}
            <Button onClick={retrySummary} variant="outline">
              Retry summary
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {summary.data ? <PortfolioSummary summary={summary.data} /> : null}
      <section aria-labelledby="home-invitations" className="section-surface">
        <h2 className="section-heading" id="home-invitations">
          Pending invitations
        </h2>
        {invitations.isPending ? (
          <p className="mt-3" role="status">
            Loading invitations…
          </p>
        ) : null}
        {invitations.error ? (
          <Alert className="mt-3" variant="destructive">
            <AlertDescription>
              {invitations.error.message}
              <Button onClick={retryInvitations} variant="outline">
                Retry invitations
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {invitations.data?.length === 0 ? (
          <p className="mt-3 text-muted-foreground text-sm">
            You have no pending invitations.
          </p>
        ) : null}
        {invitations.data?.length ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {invitations.data.length}{" "}
              {invitations.data.length === 1 ? "invitation" : "invitations"}{" "}
              waiting.
            </p>
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/estates"
            >
              Review invitations
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
