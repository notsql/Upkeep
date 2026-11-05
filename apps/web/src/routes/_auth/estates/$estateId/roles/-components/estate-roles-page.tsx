import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { SearchX, ShieldCheck } from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FilterBar, useFilterPanel } from "@/components/filter-bar";
import { LoadingState } from "@/components/loading-state";
import { CreateButton } from "@/components/page-actions";
import { ListPageHeader } from "@/components/page-header";
import {
  type EstatePermission,
  type EstateRoleDefinition,
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { DeleteRoleDialog } from "@/routes/_auth/estates/$estateId/roles/-components/delete-role-dialog";
import { RoleAccessGate } from "@/routes/_auth/estates/$estateId/roles/-components/role-access-gate";
import { RoleRow } from "@/routes/_auth/estates/$estateId/roles/-components/role-row";

type EstateAccess = components["schemas"]["EstateAccessResponse"];

function RoleTable({
  roles,
  catalogue,
  estate,
  onDelete,
  onClear,
}: {
  roles: EstateRoleDefinition[];
  catalogue: EstatePermission[];
  estate: EstateAccess;
  onDelete: (role: EstateRoleDefinition) => void;
  onClear: () => void;
}) {
  if (!roles.length) {
    return (
      <EmptyState
        action={
          <Button onClick={onClear} variant="outline">
            Clear filters
          </Button>
        }
        description="Try another name or description"
        icon={SearchX}
        title="No matching roles"
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label="Custom roles">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Role</TableHead>
            <TableHead scope="col">Permissions</TableHead>
            <TableHead className="text-right" scope="col">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <RoleRow
              catalogue={catalogue}
              estate={estate}
              key={role.id}
              onDelete={onDelete}
              role={role}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RoleWorkspace({
  estateId,
  estate,
}: {
  estateId: string;
  estate: EstateAccess;
}) {
  const catalogue = useEstateRolePermissions(estateId);
  const definitions = useEstateRoleDefinitions(estateId);
  const [deleting, setDeleting] = useState<EstateRoleDefinition>();
  const closeDeletion = useCallback(() => setDeleting(undefined), []);
  const refresh = useCallback(() => {
    catalogue.refetch();
    definitions.refetch();
  }, [catalogue, definitions]);
  const inactive = ![
    estate.canCreateRoles,
    estate.canEditRoles,
    estate.canDeleteRoles,
  ].some(Boolean);
  const canCreate = estate.canCreateRoles && Boolean(catalogue.data);
  const error = catalogue.error ?? definitions.error;
  const searchId = useId();
  const [search, setSearch] = useState("");
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    []
  );
  const clearSearch = useCallback(() => setSearch(""), []);
  const query = search.trim().toLowerCase();
  const activeCount = query ? 1 : 0;
  const panel = useFilterPanel(activeCount);
  const all = definitions.data ?? [];
  const roles = all.filter(
    (role) =>
      !query ||
      role.name.toLowerCase().includes(query) ||
      (role.description ?? "").toLowerCase().includes(query)
  );
  const create = canCreate
    ? { params: { estateId }, to: "/estates/$estateId/roles/new" as const }
    : undefined;

  let content: ReactNode;
  if (catalogue.isPending || definitions.isPending) {
    content = <LoadingState label="Loading roles…" variant="table" />;
  } else if (error) {
    content = (
      <ErrorState
        message={error.message}
        onRetry={refresh}
        retryLabel="Retry roles"
      />
    );
  } else if (all.length) {
    content = (
      <RoleTable
        catalogue={catalogue.data ?? []}
        estate={estate}
        onClear={clearSearch}
        onDelete={setDeleting}
        roles={roles}
      />
    );
  } else {
    content = (
      <EmptyState
        action={create ? <CreateButton {...create} /> : undefined}
        description="Custom permission sets for members"
        title="No custom roles yet"
      />
    );
  }

  return (
    <>
      <ListPageHeader
        create={create}
        filters={all.length ? { activeCount, ...panel.toggleProps } : undefined}
        icon={ShieldCheck}
        title="Roles"
      />
      <div className="grid gap-5">
        {all.length ? (
          <FilterBar
            activeCount={activeCount}
            label="Filter roles"
            onClear={clearSearch}
            search={
              <Field>
                <FieldLabel htmlFor={searchId}>Search roles</FieldLabel>
                <Input
                  id={searchId}
                  onChange={changeSearch}
                  placeholder="Search by name or description"
                  type="search"
                  value={search}
                />
              </Field>
            }
            {...panel.barProps}
          />
        ) : null}
        {inactive ? (
          <Alert>
            <AlertDescription>
              Estate inactive · roles read-only
            </AlertDescription>
          </Alert>
        ) : null}
        {content}
      </div>
      <DeleteRoleDialog
        estateId={estateId}
        onClose={closeDeletion}
        role={deleting}
      />
    </>
  );
}

export function EstateRolesPage({ estateId }: { estateId: string }) {
  return (
    <RoleAccessGate estateId={estateId}>
      {(estate) => <RoleWorkspace estate={estate} estateId={estateId} />}
    </RoleAccessGate>
  );
}
