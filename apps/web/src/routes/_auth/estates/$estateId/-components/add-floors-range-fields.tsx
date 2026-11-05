import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import type { ChangeEvent } from "react";

export function AddFloorsRangeFields({
  id,
  lowest,
  highest,
  onLowestChange,
  onHighestChange,
}: {
  id: string;
  lowest: string;
  highest: string;
  onLowestChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onHighestChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-1">
        <Label htmlFor={`${id}-lowest`}>Lowest floor</Label>
        <Input
          aria-describedby={`${id}-help`}
          autoComplete="off"
          id={`${id}-lowest`}
          onChange={onLowestChange}
          placeholder="B2"
          value={lowest}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${id}-highest`}>Highest floor</Label>
        <Input
          aria-describedby={`${id}-help`}
          autoComplete="off"
          id={`${id}-highest`}
          onChange={onHighestChange}
          placeholder="L25"
          value={highest}
        />
      </div>
    </div>
  );
}
