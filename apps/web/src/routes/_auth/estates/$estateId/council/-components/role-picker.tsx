import type { components } from "@proj/api/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { useCallback } from "react";

export type RoleOption =
  components["schemas"]["EstateInvitationRoleOptionResponse"];

export const presetOptions: RoleOption[] = [
  {
    role: "COUNCIL",
    label: "Council member",
    customRoleId: null,
    customRoleVersion: null,
    permissions: null,
  },
  {
    role: "RESIDENT",
    label: "Resident",
    customRoleId: null,
    customRoleVersion: null,
    permissions: null,
  },
  {
    role: "MANAGER",
    label: "Manager (Admin)",
    customRoleId: null,
    customRoleVersion: null,
    permissions: null,
  },
  {
    role: "CREW",
    label: "Crew",
    customRoleId: null,
    customRoleVersion: null,
    permissions: null,
  },
];

export function roleValue(option: RoleOption): string {
  return option.customRoleId ?? option.role;
}

export function roleSelection(
  option: RoleOption
): components["schemas"]["UpdateEstateRoleRequest"] {
  if (option.role === "CUSTOM") {
    if (!(option.customRoleId && option.customRoleVersion)) {
      throw new Error("Review the current custom role before saving.");
    }
    return {
      role: "CUSTOM",
      customRoleId: option.customRoleId,
      expectedRoleVersion: option.customRoleVersion,
    };
  }
  return { role: option.role };
}

export function RolePicker({
  value,
  onChange,
  label,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (role: RoleOption) => void;
  label: string;
  options: RoleOption[];
  disabled?: boolean;
}) {
  const change = useCallback(
    (selected: string | null) => {
      const option = options.find((item) => roleValue(item) === selected);
      if (option) {
        onChange(option);
      }
    },
    [onChange, options]
  );
  return (
    <Select
      disabled={disabled}
      items={options.map((option) => ({
        value: roleValue(option),
        label: option.label,
      }))}
      onValueChange={change}
      value={value}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={roleValue(option)} value={roleValue(option)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
