import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  ClipboardCheck,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { SummaryCard } from "@/components/summary-card";
import {
  type InspectionCheck,
  type InspectionList,
  useGenerateInspectionList,
  useInspectionList,
} from "@/lib/inspection-list";
import { useInspectionAccess } from "@/lib/inspections";
import { CheckTable } from "@/routes/_auth/estates/$estateId/inspections/-components/check-table";

interface Group {
  checks: InspectionCheck[];
  key: string;
  level: string;
}

interface Block {
  groups: Group[];
  id: string;
  name: string;
}

/** Blocks, then levels, in the server's order (block-wide first, then levels in order). */
function byBlock(checks: InspectionCheck[]): Block[] {
  const blocks: Block[] = [];
  for (const check of checks) {
    let block = blocks.find((candidate) => candidate.id === check.block.id);
    if (!block) {
      block = { id: check.block.id, name: check.block.name, groups: [] };
      blocks.push(block);
    }
    const key = check.level?.id ?? `${check.block.id}-block`;
    let group = block.groups.find((candidate) => candidate.key === key);
    if (!group) {
      group = { key, level: check.level?.name ?? "Block-wide", checks: [] };
      block.groups.push(group);
    }
    group.checks.push(check);
  }
  return blocks;
}

function monthLabel(month: string): string {
  return new Date(`${month}T00:00:00`).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
}

function addedMessage(added: number): string {
  if (added === 0) {
    return "No new checks are due.";
  }
  return added === 1 ? "Added 1 check." : `Added ${added} checks.`;
}

function BlockSection({
  block,
  estateId,
  canRecord,
}: {
  block: Block;
  estateId: string;
  canRecord: boolean;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <h2 className="text-lg font-semibold" id={headingId}>
        {block.name}
      </h2>
      {block.groups.map((group) => (
        <section
          aria-label={`${block.name}, ${group.level}`}
          className="grid gap-2"
          key={group.key}
        >
          <h3 className="text-muted-foreground text-sm font-medium">
            {group.level}
          </h3>
          <CheckTable
            canRecord={canRecord}
            checks={group.checks}
            estateId={estateId}
          />
        </section>
      ))}
    </section>
  );
}

function SummaryCards({
  data,
  estateId,
}: {
  data: InspectionList;
  estateId: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={TriangleAlert}
        title="Overdue"
        value={data.overdueCount}
        warning={data.overdueCount > 0}
      >
        <p className="text-muted-foreground text-sm">
          Missed in an earlier month
        </p>
      </SummaryCard>
      <SummaryCard
        icon={CalendarClock}
        title="Due this month"
        value={data.dueCount}
      >
        <p className="text-muted-foreground text-sm">Still to check</p>
      </SummaryCard>
      <SummaryCard
        icon={CircleCheck}
        title="Done this month"
        value={data.doneCount}
      >
        <p className="text-muted-foreground text-sm">Inspected this month</p>
      </SummaryCard>
      {data.unscheduled.length > 0 ? (
        <SummaryCard
          icon={CircleDashed}
          title="Not scheduled"
          value={data.unscheduled.length}
          warning
        >
          <p className="text-muted-foreground text-sm">
            Flagged assets with no service interval
          </p>
          <Link
            className={buttonVariants({
              className: "justify-self-start",
              size: "sm",
              variant: "outline",
            })}
            params={{ estateId }}
            to="/estates/$estateId/asset-categories"
          >
            Set service intervals
          </Link>
        </SummaryCard>
      ) : null}
    </div>
  );
}

function Unscheduled({ data }: { data: InspectionList }) {
  const headingId = useId();
  if (data.unscheduled.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 className="text-lg font-semibold" id={headingId}>
        Not scheduled assets
      </h2>
      <p className="text-muted-foreground text-sm">
        These flagged assets have been inspected or installed, but have no
        service interval, so no due date can be worked out.
      </p>
      <ul className="grid gap-1">
        {data.unscheduled.map((asset) => (
          <li className="flex flex-wrap gap-2" key={asset.assetId}>
            <span>{`${asset.assetReference} · ${asset.assetName}`}</span>
            <span className="text-muted-foreground">{asset.categoryLabel}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GenerateButton({
  data,
  pending,
  onGenerate,
}: {
  data: InspectionList;
  pending: boolean;
  onGenerate: () => void;
}) {
  return (
    <Button
      disabled={!data.estateActive || pending}
      onClick={onGenerate}
      type="button"
    >
      {data.generatedAt ? "Regenerate list" : "Generate list"}
    </Button>
  );
}

function NoChecks({ generated }: { generated: boolean }) {
  return (
    <EmptyState
      description={
        generated
          ? "No flagged assets are due for a check this month."
          : "Generate this month's list to see the checks that are due."
      }
      icon={ClipboardCheck}
      title="No checks this month"
    />
  );
}

/** The estate's monthly inspection list with overdue checks (ID-84, ID-86). */
export function InspectionsPage({ estateId }: { estateId: string }) {
  const list = useInspectionList(estateId);
  const generate = useGenerateInspectionList(estateId);
  const access = useInspectionAccess(estateId);
  const [error, setError] = useState<string>();
  const { mutateAsync } = generate;
  const run = useCallback(async () => {
    setError(undefined);
    try {
      const result = await mutateAsync();
      toast.success(addedMessage(result.added));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to generate the list. Please try again."
      );
    }
  }, [mutateAsync]);
  const { data } = list;

  return (
    <PageLayout>
      <PageHeader
        actions={
          data ? (
            <GenerateButton
              data={data}
              onGenerate={run}
              pending={generate.isPending}
            />
          ) : null
        }
        description={data ? monthLabel(data.month) : undefined}
        title="Inspections"
      />
      {list.isPending ? <LoadingState label="Loading inspections…" /> : null}
      {list.error ? (
        <Alert variant="destructive">
          <AlertDescription>{list.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {data ? (
        <div className="grid gap-6">
          <SummaryCards data={data} estateId={estateId} />
          <div className="grid gap-2">
            {data.generatedAt ? (
              <p className="text-muted-foreground text-sm">
                Last generated by {data.generatedByName ?? "Unknown user"} ·{" "}
                {new Date(data.generatedAt).toLocaleString()}
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm">
              {data.generatedAt
                ? "Regenerating adds newly due checks and never duplicates them."
                : "This month's list hasn't been generated yet."}
            </p>
            {data.estateActive ? null : (
              <p className="text-muted-foreground text-sm" role="note">
                This estate is inactive, so its inspection list cannot be
                generated.
              </p>
            )}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          {data.flaggedCategoryCount === 0 ? (
            <Alert
              aria-label="No flagged categories"
              className="gap-3 p-4"
              role="note"
            >
              <AlertDescription className="text-sm">
                No asset categories are flagged as failing silently, so no
                checks can be due.
              </AlertDescription>
              <Link
                className={buttonVariants({
                  className: "justify-self-start",
                  size: "sm",
                  variant: "outline",
                })}
                params={{ estateId }}
                to="/estates/$estateId/asset-categories"
              >
                Flag categories
              </Link>
            </Alert>
          ) : null}
          {data.checks.length === 0 ? (
            <NoChecks generated={!!data.generatedAt} />
          ) : (
            byBlock(data.checks).map((block) => (
              <BlockSection
                block={block}
                canRecord={access.canCreate}
                estateId={estateId}
                key={block.id}
              />
            ))
          )}
          <Unscheduled data={data} />
        </div>
      ) : null}
    </PageLayout>
  );
}
