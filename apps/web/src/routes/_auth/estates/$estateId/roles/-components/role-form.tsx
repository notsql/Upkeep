import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Checkbox } from "@proj/ui/components/checkbox";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Spinner } from "@proj/ui/components/spinner";
import { Textarea } from "@proj/ui/components/textarea";
import { Check } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";
import type {
  EstatePermission,
  EstatePermissionCode,
  EstateRoleDefinition,
} from "@/lib/estate-roles";

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

function labelOf(catalogue: EstatePermission[], code: string): string {
  return catalogue.find((entry) => entry.code === code)?.label ?? code;
}

function PermissionChoice({
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

/**
 * Role details + permissions grouped by area. Used by the new-role and
 * edit-role pages; `cancel` is the page's outline back/cancel link.
 */
export function RoleForm({
  catalogue,
  initial,
  pending,
  error,
  onSave,
  cancel,
}: {
  catalogue: EstatePermission[];
  initial?: EstateRoleDefinition;
  pending: boolean;
  error: Error | null;
  onSave: (body: components["schemas"]["CreateEstateRoleRequest"]) => void;
  cancel?: ReactNode;
}) {
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
  return (
    <form
      aria-label={initial ? `Edit ${initial.name}` : "New role"}
      className="grid gap-5"
      onSubmit={submit}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Details</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Role name</FieldLabel>
            <Input
              disabled={pending}
              id={`${id}-name`}
              maxLength={40}
              onChange={changeName}
              required
              value={name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
            <Textarea
              disabled={pending}
              id={`${id}-description`}
              maxLength={500}
              onChange={changeDescription}
              value={description}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Permissions</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {groups.map((group) => (
            <fieldset
              className="grid min-w-0 gap-2"
              disabled={pending}
              key={group.area}
            >
              <legend className="mb-1 text-sm font-medium">{group.area}</legend>
              <div className="grid gap-2 md:grid-cols-2">
                {group.permissions.map((permission) => (
                  <PermissionChoice
                    catalogue={catalogue}
                    checked={selected.includes(permission.code)}
                    id={id}
                    key={permission.code}
                    onChange={toggle}
                    permission={permission}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>
      {message ? (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {cancel ?? null}
        <Button disabled={pending || !catalogue.length} type="submit">
          {pending ? (
            <>
              <Spinner /> Saving role…
            </>
          ) : (
            <>
              <Check aria-hidden="true" /> {action}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
