import type { components } from "@proj/api/schema";
import { Button } from "@proj/ui/components/button";
import { Checkbox } from "@proj/ui/components/checkbox";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Textarea } from "@proj/ui/components/textarea";
import { ChevronDown } from "lucide-react";
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
    <TableRow>
      <TableCell className="align-top">
        <Checkbox
          aria-describedby={`${fieldId}-description`}
          checked={checked}
          id={fieldId}
          onCheckedChange={change}
        />
      </TableCell>
      <TableCell className="whitespace-normal align-top">
        <Label className="leading-normal" htmlFor={fieldId}>
          {permission.label}
        </Label>
      </TableCell>
      <TableCell className="space-y-1 whitespace-normal align-top">
        <p
          className="text-muted-foreground text-sm"
          id={`${fieldId}-description`}
        >
          {permission.description}
        </p>
        {permission.requires.length ? (
          <p className="text-muted-foreground text-xs">
            Prerequisites:{" "}
            {permission.requires
              .map(
                (code) =>
                  catalogue.find((entry) => entry.code === code)?.label ?? code
              )
              .join(", ")}
            . Select each prerequisite explicitly.
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function RoleForm({
  catalogue,
  initial,
  pending,
  error,
  onSave,
  onCancel,
}: {
  catalogue: EstatePermission[];
  initial?: EstateRoleDefinition;
  pending: boolean;
  error: Error | null;
  onSave: (body: components["schemas"]["CreateEstateRoleRequest"]) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selected, setSelected] = useState<EstatePermissionCode[]>(
    initial?.permissions ?? []
  );
  const [validation, setValidation] = useState<string>();
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const togglePermissions = useCallback(
    () => setPermissionsOpen((open) => !open),
    []
  );
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
      if (!selected.length) {
        setValidation("Choose at least one permission.");
        return;
      }
      for (const permission of catalogue) {
        const missing = permission.requires.filter(
          (code) => !selected.includes(code)
        );
        if (selected.includes(permission.code) && missing.length) {
          setValidation(
            `${permission.label} requires ${missing.map((code) => catalogue.find((entry) => entry.code === code)?.label ?? code).join(", ")}.`
          );
          return;
        }
      }
      setValidation(undefined);
      onSave({
        name: name.trim(),
        description: description.trim() || null,
        permissions: selected,
      });
    },
    [pending, selected, catalogue, name, description, onSave]
  );
  const action = initial ? "Save role" : "Create role";
  const buttonLabel = pending ? "Saving role…" : action;
  const message = validation || error?.message;
  return (
    <form
      aria-label={initial ? `Edit ${initial.name}` : "Create estate role"}
      className="grid gap-4"
      onSubmit={submit}
    >
      <div className="grid gap-2">
        <Label htmlFor={`${id}-name`}>Role name</Label>
        <Input
          disabled={pending}
          id={`${id}-name`}
          maxLength={40}
          onChange={changeName}
          required
          value={name}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <Textarea
          disabled={pending}
          id={`${id}-description`}
          maxLength={500}
          onChange={changeDescription}
          value={description}
        />
      </div>
      <fieldset className="grid min-w-0 gap-3" disabled={pending}>
        <legend className="sr-only">Permissions</legend>
        <Button
          aria-controls={`${id}-permissions`}
          aria-expanded={permissionsOpen}
          className="w-full justify-between"
          disabled={pending}
          onClick={togglePermissions}
          type="button"
          variant="outline"
        >
          Permissions
          <ChevronDown
            aria-hidden="true"
            className={permissionsOpen ? "size-4 rotate-180" : "size-4"}
          />
        </Button>
        <div
          className="rounded-lg border"
          hidden={!permissionsOpen}
          id={`${id}-permissions`}
        >
          <Table aria-label="Permissions">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16" scope="col">
                  Select
                </TableHead>
                <TableHead scope="col">Permission name</TableHead>
                <TableHead scope="col">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogue.map((permission) => (
                <PermissionChoice
                  catalogue={catalogue}
                  checked={selected.includes(permission.code)}
                  id={id}
                  key={permission.code}
                  onChange={toggle}
                  permission={permission}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </fieldset>
      {initial ? (
        <p>
          Permission changes affect current members and pending invitations.
        </p>
      ) : null}
      {message ? <p role="alert">{message}</p> : null}
      <div className="flex gap-2">
        <Button disabled={pending || !catalogue.length} type="submit">
          {buttonLabel}
        </Button>
        {onCancel ? (
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
