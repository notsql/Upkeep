# 0045 - Reading charts use shadcn Chart, over bucketed server series

## Status

Accepted (2026-11-08). Spec: [asset-readings-charts](../features/asset-readings-charts.md).

## Decision

The asset overview's Trends card draws readings with shadcn `Chart`
(`packages/ui/src/components/chart.tsx`, recharts underneath), and its Live
toggle is a shadcn `Switch`.

- **Library.** shadcn Chart takes its colours from the preset's
  `--chart-*` and `--destructive` tokens, so charts follow light and dark
  themes with no custom CSS (rule 9). recharts 3.8.0 is a dependency of
  `packages/ui` only. `apps/web` imports `@proj/ui/components/chart` and the
  recharts primitives it needs from `@proj/ui/lib/recharts`, a re-export in
  `packages/ui`, so `apps/web` declares no recharts dependency of its own.
- **Server-side bucketing and grouping.** `getAssetReadingSeries` returns at
  most 300 epoch-aligned buckets (min/max/avg/count) per metric, and
  `getAssetReadingGroups` groups readings by timestamp and source. The client
  never receives raw 1 Hz data beyond the 1 min window (where a 1 s bucket is
  one sample), and never groups or aggregates rows itself.
- **Live is polling.** Live refetches every 1 s, only on the 1 min and 15 min
  ranges, opt-in per viewer, and stops in hidden tabs. Other ranges refresh
  every 60 s.

Rejected:
- **Hand-drawn SVG.** Axes, tooltips, gaps and bands would all be ours to build
  and keep accessible.
- **Other chart libraries** (Chart.js, ECharts, visx). None has a shadcn
  component, so each would need its own theming.
- **Raw readings to the client.** 24 h at 1 Hz is 432,000 rows across five
  metrics.
- **Push (SSE/WebSocket).** Needs connection handling on Cloud Run for a POC
  with a handful of viewers; 1 s polling on short windows is enough.

## Consequences

recharts is pinned to `3.8.0` directly in `packages/ui/package.json` (as the
shadcn CLI wrote it), not through the `catalog:`. Moving it to the catalog
needs another `pnpm install`, so it is left for a later change. recharts SVG is
not asserted on in jsdom; tests assert on each chart's accessible summary and
the "Show as table" table instead.
