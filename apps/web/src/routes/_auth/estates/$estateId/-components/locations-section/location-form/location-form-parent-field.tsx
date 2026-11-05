import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";

export function LocationFormParentField({
  id,
  initialParentId,
  parentOptions,
}: {
  id: string;
  initialParentId?: string;
  parentOptions: { id: string; label: string }[];
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={`${id}-parent`}>Inside</Label>
      <Select
        defaultValue={initialParentId}
        items={parentOptions.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        name="parentId"
      >
        <SelectTrigger className="w-full" id={`${id}-parent`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {parentOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
