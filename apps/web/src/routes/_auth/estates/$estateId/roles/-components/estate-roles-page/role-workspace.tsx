import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { ShieldCheck } from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";
import { FilterBar, useFilterPanel } from "@/components/filters/filter-bar";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PEOPLE_TITLE, PeopleViews } from "@/components/people/people-views";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type EstateRoleDefinition,
  useEstateRoleDefinitions,
  useEstateRolePermissions,
} from "@/lib/estate-roles";
import { DeleteRoleDialog } from "@/routes/_auth/estates/$estateId/roles/-components/estate-roles-page/delete-role-dialog";

import {
  type EstateAccess,
  RoleTable,
} from "@/routes/_auth/estates/$estateId/roles/-components/estate-roles-page/role-table";

export function RoleWorkspace({
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
        description={
          create
            ? "Use Create to add the first custom role"
            : "Custom permission sets for members"
        }
        icon={ShieldCheck}
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
        title={PEOPLE_TITLE}
      />
      <PeopleViews estateId={estateId} permission={estate} />
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
