import { type ChartConfig, ChartContainer } from "@proj/ui/components/chart";
import { ComposedChart, Line, YAxis } from "@proj/ui/lib/recharts";
import type { ChartRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-data";

const config = {
  avg: { label: "Average", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** A tile's 32 px avg line: no axes, grid, tooltip or dots; hidden from AT. */
export function Sparkline({ rows }: { rows: ChartRow[] }) {
  return (
    <ChartContainer
      aria-hidden="true"
      className="aspect-auto h-8 w-full"
      config={config}
    >
      <ComposedChart
        data={rows}
        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
      >
        <YAxis domain={["auto", "auto"]} hide />
        <Line
          connectNulls={false}
          dataKey="avg"
          dot={false}
          isAnimationActive={false}
          stroke="var(--color-avg)"
          strokeWidth={1.5}
          type="linear"
        />
      </ComposedChart>
    </ChartContainer>
  );
}
