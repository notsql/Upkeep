import type { InspectionCheck } from "@/lib/inspection-list";
import {
  type Block,
  BlockSection,
} from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/block-section";
import { NoChecks } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/no-checks";

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
export function InspectionsChecks({
  canRecord,
  checks,
  estateId,
  generated,
}: {
  canRecord: boolean;
  checks: InspectionCheck[];
  estateId: string;
  generated: boolean;
}) {
  if (checks.length === 0) {
    return <NoChecks generated={generated} />;
  }
  return byBlock(checks).map((block) => (
    <BlockSection
      block={block}
      canRecord={canRecord}
      estateId={estateId}
      key={block.id}
    />
  ));
}
