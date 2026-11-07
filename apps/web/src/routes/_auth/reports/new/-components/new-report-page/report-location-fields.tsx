import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
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
  const commonAreas = locations.filter(
    (item) =>
      item.type === "COMMON_AREA" &&
      item.id &&
      (item.parentId === blockId || item.parentId === levelId)
  );
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-block`}>Block</Label>
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
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-level`}>Level</Label>
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
      </div>
      {commonAreas.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-common`}>Common area (optional)</Label>
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
              {commonAreas.map((area) => (
                <SelectItem key={area.id} value={area.id ?? ""}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </>
  );
}
