import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { AdminUsersAccessDialog } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-access-dialog";
import { AdminUsersFilters } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-filters";
import { AdminUsersHeader } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-header";
import { AdminUsersMembers } from "@/routes/_auth/admin/users/-components/admin-users-page/admin-users-members/admin-users-members";
import { useAdminUsersPage } from "@/routes/_auth/admin/users/-components/admin-users-page/use-admin-users-page";

export function AdminUsersPage() {
  const page = useAdminUsersPage();
  const { organizations, roleUpdate } = page;

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminUsersHeader
          filters={
            organizations.data?.length
              ? { activeCount: page.activeCount, ...page.panel.toggleProps }
              : undefined
          }
          totalUsers={page.members.data?.length}
        />

        {page.loadError ? (
          <ErrorState
            message={page.loadError.message}
            onRetry={page.retryLoad}
          />
        ) : null}

        {roleUpdate.error ? (
          <p className="text-destructive text-sm" role="alert">
            {roleUpdate.error.message}
          </p>
        ) : null}

        {organizations.isPending ? (
          <LoadingState label="Loading estates…" rows={2} />
        ) : null}

        {organizations.data?.length === 0 && (
          <EmptyState
            description="Created estates appear here"
            title="No estates yet"
          />
        )}

        {Boolean(organizations.data?.length) && (
          <AdminUsersFilters
            activeCount={page.activeCount}
            barProps={page.panel.barProps}
            disabled={roleUpdate.isPending}
            onClear={page.clearSearch}
            onOrganizationChange={page.handleOrganizationChange}
            onSearchChange={page.handleSearchChange}
            organizationId={page.organizationId}
            organizationItems={page.organizationItems}
            organizations={organizations.data}
            search={page.search}
          />
        )}

        {page.isLoadingOrganization ? (
          <LoadingState label="Loading members and roles…" variant="table" />
        ) : null}

        {roleUpdate.isPending ? (
          <p className="text-muted-foreground text-sm" role="status">
            Saving role and refreshing members…
          </p>
        ) : null}

        <AdminUsersMembers
          list={{
            users: page.filteredUsers,
            roles: page.organizationRoles.data ?? [],
            rolesUnavailable: page.rolesUnavailable,
            pending: roleUpdate.isPending,
            onRoleChange: page.handleRoleChange,
            onManage: page.handleManageEstates,
          }}
          membersLoaded={page.members.isSuccess}
          mobile={page.mobile}
          onClearSearch={page.clearSearch}
          organizationSelected={Boolean(page.organizationId)}
          searching={Boolean(page.search.trim())}
        />

        <AdminUsersAccessDialog
          onOpenChange={page.closeAccess}
          onPendingChange={page.setAccessPending}
          pending={page.accessPending}
          returnFocus={page.returnFocus}
          selectedMember={page.selectedMember}
        />

        <p className="text-muted-foreground text-xs">
          Role changes are saved automatically. Members with multiple roles must
          be managed in WorkOS.
        </p>
      </div>
    </PageLayout>
  );
}
