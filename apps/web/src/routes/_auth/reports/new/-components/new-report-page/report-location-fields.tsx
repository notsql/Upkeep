import { Field, FieldLabel } from "@proj/ui/components/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import type { ResidentLocation } from "@/lib/reports";

export function ReportLocationFields({
  id,
  locations,
  blockId,
  levelId,
  commonId,
  onBlockChange,
  onLevelChange,
  onCommonChange,
}: {
  id: string;
  locations: ResidentLocation[];
  blockId: string | null;
  levelId: string | null;
  commonId: string | null;
  onBlockChange: (value: string | null) => void;
  onLevelChange: (value: string | null) => void;
  onCommonChange: (value: string | null) => void;
}) {
  const blocks = locations.filter((item) => item.type === "BLOCK" && item.id);
  const levels = locations.filter(
    (item) => item.type === "LEVEL" && item.parentId === blockId && item.id
  );
  const commonIn = (parentId: string | null) =>
    parentId
      ? locations.filter(
          (item) =>
            item.type === "COMMON_AREA" && item.id && item.parentId === parentId
        )
      : [];
  const levelName = levels.find((level) => level.id === levelId)?.name;
  const blockName = blocks.find((block) => block.id === blockId)?.name;
  // Areas on the chosen level first, then the block's own areas, labelled so
  // "Lift lobby" on L1 and a block-wide "Playground" are not one flat list.
  const commonGroups = [
    { key: "level", label: `On ${levelName}`, areas: commonIn(levelId) },
    {
      key: "block",
      label: `Anywhere in ${blockName}`,
      areas: commonIn(blockId),
    },
  ].filter((group) => group.areas.length > 0);
  const commonAreas = commonGroups.flatMap((group) => group.areas);
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-block`}>Block</FieldLabel>
          <Select
            items={blocks.map((block) => ({
              value: block.id ?? "",
              label: block.name ?? "",
            }))}
            onValueChange={onBlockChange}
            value={blockId}
          >
            <SelectTrigger className="w-full" id={`${id}-block`}>
              <SelectValue placeholder="Choose block" />
            </SelectTrigger>
            <SelectContent>
              {blocks.map((block) => (
                <SelectItem key={block.id} value={block.id ?? ""}>
                  {block.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-level`}>Level</FieldLabel>
          <Select
            disabled={!blockId}
            items={levels.map((level) => ({
              value: level.id ?? "",
              label: level.name ?? "",
            }))}
            onValueChange={onLevelChange}
            value={levelId}
          >
            <SelectTrigger className="w-full" id={`${id}-level`}>
              <SelectValue placeholder="Choose level" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((level) => (
                <SelectItem key={level.id} value={level.id ?? ""}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {commonAreas.length > 0 ? (
        <Field>
          <FieldLabel htmlFor={`${id}-common`}>
            Common area (optional)
          </FieldLabel>
          <Select
            items={commonAreas.map((area) => ({
              value: area.id ?? "",
              label: area.name ?? "",
            }))}
            onValueChange={onCommonChange}
            value={commonId}
          >
            <SelectTrigger className="w-full" id={`${id}-common`}>
              <SelectValue placeholder="Choose common area" />
            </SelectTrigger>
            <SelectContent>
              {commonGroups.map((group) => (
                <SelectGroup key={group.key}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.areas.map((area) => (
                    <SelectItem key={area.id} value={area.id ?? ""}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </>
  );
}
