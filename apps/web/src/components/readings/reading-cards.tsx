import { Badge } from "@proj/ui/components/badge";
import { Card, CardContent, CardHeader } from "@proj/ui/components/card";
import { ReadingProvenance } from "@/components/readings/reading-provenance";
import { deviceMetrics } from "@/lib/devices";
import {
  type AssetReading,
  type EstateReading,
  flagLabel,
} from "@/lib/readings";

export function ReadingCards({
  items,
  refreshing = false,
}: {
  items: (AssetReading | EstateReading)[];
  refreshing?: boolean;
}) {
  return (
    <ul
      aria-busy={refreshing}
      aria-label="Readings"
      className="grid min-w-0 gap-3"
    >
      {items.map((reading) => (
        <li className="min-w-0" key={reading.id}>
          <Card
            className="min-w-0 rounded-xl [overflow-wrap:anywhere]"
            size="sm"
          >
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium text-sm">
                    {deviceMetrics[reading.metric].name}
                  </h2>
                  <p className="font-semibold text-lg">
                    {reading.valueText ?? reading.value} {reading.unit}
                  </p>
                </div>
                <ReadingProvenance reading={reading} />
              </div>
              {"assetReference" in reading ? (
                <div>
                  <p className="font-medium">{reading.assetName}</p>
                  <p className="text-muted-foreground">
                    {reading.assetReference}
                  </p>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid gap-2">
                <div>
                  <dt className="text-muted-foreground">Measured</dt>
                  <dd>
                    <time dateTime={reading.measuredAt}>
                      {new Date(reading.measuredAt).toLocaleString()}
                    </time>
                  </dd>
                </div>
                {reading.deviceIdentifier ? (
                  <div>
                    <dt className="text-muted-foreground">Device</dt>
                    <dd>{reading.deviceIdentifier}</dd>
                  </div>
                ) : null}
              </dl>
              {reading.flags.length ? (
                <div className="flex min-w-0 flex-wrap items-start gap-1">
                  {reading.flags.map((flag) => (
                    <Badge
                      className="h-auto max-w-full whitespace-normal py-0.5 text-left leading-snug"
                      key={flag.type}
                      variant="outline"
                    >
                      {flagLabel(flag, reading.unit)}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
