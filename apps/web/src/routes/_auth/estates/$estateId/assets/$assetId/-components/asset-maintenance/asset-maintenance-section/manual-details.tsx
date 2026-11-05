import type { AssetEvent } from "@/lib/asset-events";

export function ManualDetails({ event }: { event: AssetEvent }) {
  const details = [
    ["Findings", event.findings],
    ["Work performed", event.workPerformed],
    ["Service provider", event.serviceProvider],
    ["Parts replaced", event.partsReplaced],
    ["Downtime (minutes)", event.downtimeMinutes?.toString()],
  ].filter(
    (detail): detail is [string, string] => typeof detail[1] === "string"
  );
  if (details.length === 0) {
    return null;
  }
  return (
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      {details.map(([term, value]) => (
        <div key={term}>
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
