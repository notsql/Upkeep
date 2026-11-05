import { Checkbox } from "@proj/ui/components/checkbox";
import { Label } from "@proj/ui/components/label";
import { useCallback } from "react";
import type {
  EstatePermission,
  EstatePermissionCode,
} from "@/lib/estate-roles";

export function labelOf(catalogue: EstatePermission[], code: string): string {
  return catalogue.find((entry) => entry.code === code)?.label ?? code;
}

export function PermissionChoice({
  permission,
  catalogue,
  id,
  checked,
  onChange,
}: {
  permission: EstatePermission;
  catalogue: EstatePermission[];
  id: string;
  checked: boolean;
  onChange: (code: EstatePermissionCode, checked: boolean) => void;
}) {
  const change = useCallback(
    (value: boolean) => onChange(permission.code, value),
    [permission.code, onChange]
  );
  const fieldId = `${id}-${permission.code}`;
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Checkbox
        aria-describedby={`${fieldId}-description`}
        checked={checked}
        className="mt-0.5"
        id={fieldId}
        onCheckedChange={change}
      />
      <div className="grid gap-1">
        <Label className="leading-normal" htmlFor={fieldId}>
          {permission.label}
        </Label>
        <p
          className="text-muted-foreground text-sm"
          id={`${fieldId}-description`}
        >
          {permission.description}
        </p>
        {permission.requires.length ? (
          <p className="text-muted-foreground text-xs">
            Prerequisite:{" "}
            {permission.requires
              .map((code) => labelOf(catalogue, code))
              .join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
