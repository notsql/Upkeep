import type { DashboardSummary } from "@/lib/dashboard";

const conditions = [
  {
    key: "good",
    label: "Good",
    colour: "bg-[var(--status-active-foreground)]",
  },
  {
    key: "needsAttention",
    label: "Needs attention",
    colour: "bg-amber-600 dark:bg-amber-400",
  },
  {
    key: "faulty",
    label: "Faulty",
    colour: "bg-red-600 dark:bg-red-400",
  },
  { key: "unassessed", label: "Not assessed", colour: "bg-muted-foreground" },
] as const;

export function AssetConditionDistribution({
  counts,
}: {
  counts: DashboardSummary["conditionCounts"];
}) {
  const total =
    counts.good + counts.needsAttention + counts.faulty + counts.unassessed;
  if (total === 0) {
    return (
      <div className="mt-4">
        <div aria-hidden="true" className="h-3 rounded-full bg-muted" />
        <p className="mt-3 text-muted-foreground text-sm">
          No active assets to assess.
        </p>
      </div>
    );
  }
  return (
    <figure aria-label="Asset condition distribution" className="mt-4">
      <figcaption className="sr-only">
        {conditions.map(({ key, label }) => (
          <span className="block" key={key}>
            {label}: {counts[key]} (
            {Math.round((counts[key] / total) * 1000) / 10}%)
          </span>
        ))}
      </figcaption>
      <div
        aria-hidden="true"
        className="flex h-3 gap-px overflow-hidden rounded-full bg-card"
      >
        {conditions
          .filter(({ key }) => counts[key] > 0)
          .map(({ key, colour }) => (
            <span
              className={colour}
              key={key}
              style={{ flexBasis: `${(counts[key] / total) * 100}%` }}
            />
          ))}
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {conditions.map(({ key, label, colour }) => (
          <div
            className="flex min-w-0 items-center justify-between gap-3"
            key={key}
          >
            <dt className="flex items-center gap-2 font-medium text-sm">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${colour}`}
              />
              {label}
            </dt>
            <dd className="shrink-0 font-semibold text-sm tabular-nums">
              {counts[key]}{" "}
              <span className="font-normal text-muted-foreground">
                ({Math.round((counts[key] / total) * 1000) / 10}%)
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
