import type { components } from "@proj/api/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Plus } from "lucide-react";
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

const CREATE_ROLE_VALUE = "__create-role__";
const CREATE_ROLE_LABEL = "Create new role…";

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
  onCreateRole,
}: {
  value: string;
  onChange: (role: RoleOption) => void;
  label: string;
  options: RoleOption[];
  disabled?: boolean;
  /** When given, the list ends with "Create new role…", which calls this instead of selecting. */
  onCreateRole?: () => void;
}) {
  const change = useCallback(
    (selected: string | null) => {
      if (selected === CREATE_ROLE_VALUE) {
        onCreateRole?.();
        return;
      }
      const option = options.find((item) => roleValue(item) === selected);
      if (option) {
        onChange(option);
      }
    },
    [onChange, onCreateRole, options]
  );
  return (
    <Select
      disabled={disabled}
      items={[
        ...options.map((option) => ({
          value: roleValue(option),
          label: option.label,
        })),
        ...(onCreateRole
          ? [{ value: CREATE_ROLE_VALUE, label: CREATE_ROLE_LABEL }]
          : []),
      ]}
      onValueChange={change}
      value={value}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={roleValue(option)} value={roleValue(option)}>
            {option.label}
          </SelectItem>
        ))}
        {onCreateRole ? (
          <>
            <SelectSeparator />
            <SelectItem value={CREATE_ROLE_VALUE}>
              <Plus aria-hidden="true" />
              {CREATE_ROLE_LABEL}
            </SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}
