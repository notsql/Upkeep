import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  type EstateRoleDefinition,
  useCreateEstateRole,
  useDeleteEstateRole,
  useEstateRoleAccess,
  useEstateRoleDefinitions,
  useEstateRolePermissions,
  useUpdateEstateRoleDefinition,
} from "@/lib/estate-roles";
import { RoleCard } from "@/routes/_auth/estates/$estateId/roles/-components/role-card";
import { RoleForm } from "@/routes/_auth/estates/$estateId/roles/-components/role-form";

type RoleBody = components["schemas"]["CreateEstateRoleRequest"];
type EstateAccess = components["schemas"]["EstateAccessResponse"];

function RoleWorkspace({
  estateId,
  estate,
}: {
  estateId: string;
  estate: EstateAccess;
}) {
  const catalogue = useEstateRolePermissions(estateId);
  const definitions = useEstateRoleDefinitions(estateId);
  const create = useCreateEstateRole(estateId);
  const update = useUpdateEstateRoleDefinition(estateId);
  const deletion = useDeleteEstateRole(estateId);
  const [editing, setEditing] = useState<EstateRoleDefinition>();
  const [deleting, setDeleting] = useState<EstateRoleDefinition>();
  const closeEditor = useCallback(() => setEditing(undefined), []);
  const closeDeletion = useCallback(() => setDeleting(undefined), []);
  const refresh = useCallback(() => {
    catalogue.refetch();
    definitions.refetch();
  }, [catalogue, definitions]);
  const saveNew = useCallback(
    (body: RoleBody) => create.mutate(body),
    [create]
  );
  const saveEdit = useCallback(
    (body: RoleBody) => {
      if (editing) {
        update.mutate(
          {
            roleId: editing.id,
            body: { ...body, expectedVersion: editing.version },
          },
          { onSuccess: closeEditor }
        );
      }
    },
    [editing, update, closeEditor]
  );
  const reload = useCallback(() => {
    const current = definitions.data?.find((role) => role.id === editing?.id);
    if (current) {
      setEditing(current);
      update.reset();
    }
  }, [definitions.data, editing?.id, update]);
  const edit = useCallback(
    (role: EstateRoleDefinition) => {
      update.reset();
      setEditing(role);
    },
    [update]
  );
  const remove = useCallback(
    (role: EstateRoleDefinition) => {
      deletion.reset();
      setDeleting(role);
    },
    [deletion]
  );
  const confirmDelete = useCallback(() => {
    if (deleting) {
      deletion.mutate(deleting.id, { onSuccess: closeDeletion });
    }
  }, [deleting, deletion, closeDeletion]);
  const toggleDeletion = useCallback(
    (open: boolean) => {
      if (!(open || deletion.isPending)) {
        closeDeletion();
      }
    },
    [deletion.isPending, closeDeletion]
  );
  const inactive = ![
    estate.canCreateRoles,
    estate.canEditRoles,
    estate.canDeleteRoles,
  ].some(Boolean);
  return (
    <>
      {inactive ? (
        <Alert>
          <AlertDescription>
            This estate is inactive. An active estate is required to create,
            edit or delete roles.
          </AlertDescription>
        </Alert>
      ) : null}
      {catalogue.isPending || definitions.isPending ? (
        <p role="status">Loading roles and permissions…</p>
      ) : null}
      {catalogue.error || definitions.error ? (
        <Alert role="alert">
          <AlertDescription>
            {catalogue.error?.message ?? definitions.error?.message}
          </AlertDescription>
          <Button onClick={refresh}>Retry roles</Button>
        </Alert>
      ) : null}
      {catalogue.data && estate.canCreateRoles && !editing ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <b>Create a role</b>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RoleForm
              catalogue={catalogue.data}
              error={create.error}
              onSave={saveNew}
              pending={create.isPending}
            />
            {create.isSuccess ? <p role="status">Role created.</p> : null}
          </CardContent>
        </Card>
      ) : null}
      {editing && catalogue.data && estate.canEditRoles ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit {editing.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <RoleForm
              catalogue={catalogue.data}
              error={update.error}
              initial={editing}
              key={`${editing.id}:${editing.version}`}
              onCancel={closeEditor}
              onSave={saveEdit}
              pending={update.isPending}
            />
            {update.error ? (
              <Button onClick={reload} variant="outline">
                Reload role
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {definitions.data?.length === 0 ? <p>No custom roles yet.</p> : null}
      <ul aria-label="Custom roles" className="grid gap-4">
        {definitions.data?.map((role) => (
          <RoleCard
            catalogue={catalogue.data ?? []}
            estate={estate}
            key={role.id}
            onDelete={remove}
            onEdit={edit}
            pending={update.isPending || deletion.isPending}
            role={role}
          />
        ))}
      </ul>
      <Dialog onOpenChange={toggleDeletion} open={Boolean(deleting)}>
        {deleting ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete custom role?</DialogTitle>
              <DialogDescription>
                All invitations and invitation history for this role will be
                permanently deleted. Pending invitation links will stop working.
              </DialogDescription>
            </DialogHeader>
            <p>{deleting.name}</p>
            {deletion.error ? (
              <p role="alert">{deletion.error.message}</p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={deletion.isPending}
                onClick={closeDeletion}
                variant="outline"
              >
                Keep role
              </Button>
              <Button
                disabled={deletion.isPending}
                onClick={confirmDelete}
                variant="destructive"
              >
                {deletion.isPending ? "Deleting role…" : "Delete role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

export function EstateRolesPage({ estateId }: { estateId: string }) {
  const { access, estate, ready, allowed } = useEstateRoleAccess(estateId);
  const retry = useCallback(() => {
    access.refetch();
  }, [access]);
  if (!ready || access.isPending) {
    return <p role="status">Loading estate access…</p>;
  }
  if (access.error) {
    return (
      <Alert role="alert">
        <AlertDescription>{access.error.message}</AlertDescription>
        <Button onClick={retry}>Retry access</Button>
      </Alert>
    );
  }
  if (!(allowed && estate)) {
    return <p role="alert">Estate roles are unavailable.</p>;
  }
  return (
    <main className="page-layout space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: estate.estateName },
          { label: "Roles" },
        ]}
        description={`Custom roles for ${estate.estateName}.`}
        title="Estate roles"
      />
      <RoleWorkspace estate={estate} estateId={estateId} />
    </main>
  );
}
