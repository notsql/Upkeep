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
import { Plus, ShieldCheck } from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import {
  type EstatePermission,
  type EstateRoleDefinition,
  useEstateRoleAccess,
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { CreateRoleDialog } from "@/routes/_auth/estates/$estateId/roles/-components/create-role-dialog";
import {
  DeleteRoleDialog,
  EditRoleDialog,
} from "@/routes/_auth/estates/$estateId/roles/-components/role-dialogs";
import { RoleRow } from "@/routes/_auth/estates/$estateId/roles/-components/role-row";

type EstateAccess = components["schemas"]["EstateAccessResponse"];

function CreateRoleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <Plus aria-hidden="true" /> Create role
    </Button>
  );
}

function RoleList({
  roles: all,
  catalogue,
  estate,
  onEdit,
  onDelete,
}: {
  roles: EstateRoleDefinition[];
  catalogue: EstatePermission[];
  estate: EstateAccess;
  onEdit: (role: EstateRoleDefinition) => void;
  onDelete: (role: EstateRoleDefinition) => void;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    []
  );
  const clearSearch = useCallback(() => setSearch(""), []);
  const query = search.trim().toLowerCase();
  const roles = all.filter(
    (role) =>
      !query ||
      role.name.toLowerCase().includes(query) ||
      (role.description ?? "").toLowerCase().includes(query)
  );
  return (
    <div className="grid gap-4">
      <FilterBar
        actions={
          query && roles.length ? (
            <Button onClick={clearSearch} variant="ghost">
              Clear filters
            </Button>
          ) : null
        }
        label="Filter roles"
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
      />
      {roles.length ? (
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
                  onEdit={onEdit}
                  role={role}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          action={
            <Button onClick={clearSearch} variant="outline">
              Clear filters
            </Button>
          }
          title="No matching roles"
        />
      )}
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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EstateRoleDefinition>();
  const [deleting, setDeleting] = useState<EstateRoleDefinition>();
  const openCreate = useCallback(() => setCreating(true), []);
  const closeEditor = useCallback(() => setEditing(undefined), []);
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

  let content: ReactNode;
  if (catalogue.isPending || definitions.isPending) {
    content = <LoadingState label="Loading roles…" variant="table" />;
  } else if (error) {
    content = (
      <Alert role="alert">
        <AlertDescription>{error.message}</AlertDescription>
        <Button onClick={refresh}>Retry roles</Button>
      </Alert>
    );
  } else if (definitions.data?.length) {
    content = (
      <RoleList
        catalogue={catalogue.data ?? []}
        estate={estate}
        onDelete={setDeleting}
        onEdit={setEditing}
        roles={definitions.data}
      />
    );
  } else {
    content = (
      <EmptyState
        action={
          canCreate ? <CreateRoleButton onClick={openCreate} /> : undefined
        }
        description="Custom roles grant a chosen set of permissions to members and invitations."
        icon={ShieldCheck}
        title="No custom roles yet"
      />
    );
  }

  return (
    <>
      <PageHeader
        actions={canCreate ? <CreateRoleButton onClick={openCreate} /> : null}
        description={`Custom roles for ${estate.estateName}.`}
        title="Estate roles"
      />
      <div className="grid gap-5">
        {inactive ? (
          <Alert>
            <AlertDescription>
              This estate is inactive. An active estate is required to create,
              edit or delete roles.
            </AlertDescription>
          </Alert>
        ) : null}
        {content}
      </div>
      <CreateRoleDialog
        estateId={estateId}
        onOpenChange={setCreating}
        open={creating}
      />
      <EditRoleDialog
        catalogue={catalogue.data ?? []}
        estateId={estateId}
        onClose={closeEditor}
        role={estate.canEditRoles ? editing : undefined}
        roles={definitions.data ?? []}
      />
      <DeleteRoleDialog
        estateId={estateId}
        onClose={closeDeletion}
        role={deleting}
      />
    </>
  );
}

export function EstateRolesPage({ estateId }: { estateId: string }) {
  const { access, estate, ready, allowed } = useEstateRoleAccess(estateId);
  const retry = useCallback(() => {
    access.refetch();
  }, [access]);
  if (!ready || access.isPending) {
    return (
      <PageLayout>
        <LoadingState label="Loading estate access…" rows={2} />
      </PageLayout>
    );
  }
  if (access.error) {
    return (
      <PageLayout>
        <Alert role="alert">
          <AlertDescription>{access.error.message}</AlertDescription>
          <Button onClick={retry}>Retry access</Button>
        </Alert>
      </PageLayout>
    );
  }
  if (!(allowed && estate)) {
    return (
      <PageLayout>
        <Alert role="alert">
          <AlertDescription>Estate roles are unavailable.</AlertDescription>
        </Alert>
      </PageLayout>
    );
  }
  return (
    <PageLayout>
      <RoleWorkspace estate={estate} estateId={estateId} />
    </PageLayout>
  );
}
