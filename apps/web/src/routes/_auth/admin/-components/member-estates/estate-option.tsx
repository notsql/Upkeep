import { Checkbox } from "@proj/ui/components/checkbox";
import { Label } from "@proj/ui/components/label";
import { type ReactNode, useCallback } from "react";

export function EstateOption({
  checked,
  children,
  disabled,
  estateId,
  onChange,
}: {
  checked: boolean;
  children: ReactNode;
  disabled: boolean;
  estateId: string;
  onChange: (estateId: string, granted: boolean) => void;
}) {
  const id = `member-estate-${estateId}`;
  const handleCheckedChange = useCallback(
    (granted: boolean) => onChange(estateId, granted),
    [estateId, onChange]
  );
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={handleCheckedChange}
      />
      <Label className="text-sm" htmlFor={id}>
        {children}
      </Label>
    </div>
  );
}
