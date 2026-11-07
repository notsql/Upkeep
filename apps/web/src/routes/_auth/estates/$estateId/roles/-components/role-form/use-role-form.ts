import type { components } from "@proj/api/schema";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useState,
} from "react";
import type {
  EstatePermission,
  EstatePermissionCode,
  EstateRoleDefinition,
} from "@/lib/estate-roles";
import { labelOf } from "@/routes/_auth/estates/$estateId/roles/-components/role-form/permission-choice";

type Area =
  | "Estate"
  | "Fault reports"
  | "Members and roles"
  | "Locations"
  | "Documents";

const AREAS: Area[] = [
  "Estate",
  "Fault reports",
  "Members and roles",
  "Locations",
  "Documents",
];

/** Client-side grouping; the catalogue DTO carries no area. */
const AREA_OF: Record<EstatePermissionCode, Area> = {
  VIEW_ESTATE: "Estate",
  EDIT_ESTATE: "Estate",
  VIEW_FAULT_REPORTS: "Fault reports",
  RELOCATE_FAULT_REPORTS: "Fault reports",
  INVITE_MEMBERS: "Members and roles",
  CREATE_ROLES: "Members and roles",
  EDIT_ROLES: "Members and roles",
  CREATE_LOCATIONS: "Locations",
  EDIT_LOCATIONS: "Locations",
  VIEW_DOCUMENTS: "Documents",
  EDIT_DOCUMENTS: "Documents",
};

function validate(
  catalogue: EstatePermission[],
  selected: EstatePermissionCode[]
): string | undefined {
  if (!selected.length) {
    return "Choose at least one permission";
  }
  for (const permission of catalogue) {
    const missing = permission.requires.filter(
      (code) => !selected.includes(code)
    );
    if (selected.includes(permission.code) && missing.length) {
      return `${permission.label} requires ${missing.map((code) => labelOf(catalogue, code)).join(", ")}`;
    }
  }
}
export function useRoleForm(
  catalogue: EstatePermission[],
  initial: EstateRoleDefinition | undefined,
  pending: boolean,
  error: Error | null,
  onSave: (body: components["schemas"]["CreateEstateRoleRequest"]) => void
) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selected, setSelected] = useState<EstatePermissionCode[]>(
    initial?.permissions ?? []
  );
  const [validation, setValidation] = useState<string>();
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );
  const changeDescription = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(event.target.value),
    []
  );
  const toggle = useCallback(
    (code: EstatePermissionCode, checked: boolean) =>
      setSelected((current) =>
        checked ? [...current, code] : current.filter((value) => value !== code)
      ),
    []
  );
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      const problem = validate(catalogue, selected);
      setValidation(problem);
      if (!problem) {
        onSave({
          name: name.trim(),
          description: description.trim() || null,
          permissions: selected,
        });
      }
    },
    [pending, selected, catalogue, name, description, onSave]
  );
  const action = initial ? "Save role" : "Create role";
  const message = validation || error?.message;
  const groups = AREAS.map((area) => ({
    area,
    permissions: catalogue.filter(
      (permission) => AREA_OF[permission.code] === area
    ),
  })).filter((group) => group.permissions.length);
  return {
    action,
    changeDescription,
    changeName,
    description,
    groups,
    id,
    message,
    name,
    selected,
    submit,
    toggle,
  };
}
