# 0046 - Semantic colour tokens in the shared stylesheet

## Status

Accepted (2026-11-09). Spec: [colour-visual-pass](../features/colour-visual-pass.md).
Supersedes the "no custom colour tokens" rule in `.docs/frontend/design-system.md`
(from the shadcn-only UI work).

## Decision

`packages/ui/src/styles/globals.css` defines project colour tokens beside the
shadcn preset's own, in both `:root` and `.dark`, each mapped to
`--color-<name>` in `@theme inline`:

- `--success`, `--warning`, `--info` (each with `-foreground`) and
  `--destructive-foreground`, for status.
- `--brand-1` (sky), `--brand-2` (brand blue, equals `--primary`), `--brand-3`
  (indigo), each with `-foreground`, for decoration only (gradients were tried and removed at the user's request).
- The preset's ring, charts and sidebar accent are retuned to blue; neutral
  surfaces stay near-neutral (light ground pure white, greys chroma <= 0.004,
  dark surfaces chroma <= 0.006). Emphasis uses icon tiles and badges, never
  side-border accents or tinted card fills.

Every status-to-colour choice lives in `apps/web/src/lib/status-tone.ts` and
resolves to a Badge variant. `Badge` and `Alert` gain `success`, `warning`
and `info` variants by extending their `cva` in place. `apps/web/src/index.css`
stays a single import, and `apps/web/src` uses no raw Tailwind palette
colours (`emerald-*`, `amber-*`, ...).

Rejected:
- **Raw Tailwind palette classes per call site.** The same meaning ended up
  with different colours on different screens, with no dark-mode guarantee.
- **Re-running the preset with another base colour.** No preset offers
  status tokens, and it would discard the brand blue.
- **Tokens in `apps/web/src/index.css`.** Keeps the shadcn theme in one place,
  shared with `packages/ui` components.

## Consequences

Re-running the shadcn preset would overwrite these values; re-apply them from
the spec's token tables afterwards. Contrast is checked by hand (no automated
test, no new dependency). A new status meaning needs a tone in
`status-tone.ts`, not a new colour class.
