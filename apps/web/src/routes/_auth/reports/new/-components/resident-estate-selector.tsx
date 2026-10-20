import type { components } from "@proj/api/schema";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";

export function ResidentEstateSelector({
  estates: assignedEstates,
  estateId,
  onChange: changeEstate,
  id,
}: {
  estates: components["schemas"]["ResidentContextResponse"]["estates"];
  estateId?: string;
  onChange: (id: string | null) => void;
  id: string;
}) {
  return (
    <>
      {" "}
      {assignedEstates.length > 1 ? (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-estate`}>Estate</Label>
          <Select
            items={assignedEstates.map((estate) => ({
              value: estate.id,
              label: estate.name,
            }))}
            onValueChange={changeEstate}
            value={estateId ?? null}
          >
            <SelectTrigger id={`${id}-estate`}>
              <SelectValue placeholder="Choose estate" />
            </SelectTrigger>
            <SelectContent>
              {assignedEstates.map((estate) => (
                <SelectItem key={estate.id} value={estate.id}>
                  {estate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </>
  );
}
