import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Users } from "lucide-react";
import { useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useAppAccess, useAuthenticatedSession } from "@/lib/access";
import { OwnerInvitations } from "@/routes/_auth/estates/$estateId/council/-components/council-page/access-controls";
import { InactiveNote } from "@/routes/_auth/estates/$estateId/council/-components/council-page/inactive-note";
import { InviteMemberDialog } from "@/routes/_auth/estates/$estateId/council/-components/council-page/invite-member-dialog/invite-member-dialog";
import {
  type CouncilView,
  MembersWorkspace,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/members-workspace";

/**
 * The Members section: header, sub-navigation and filters shared by the
 * members route (`council/`) and the pending-invitations route
 * (`council/invitations/`), which pass `view`.
 */
export function CouncilPage({
  estateId,
  view = "members",
}: {
  estateId: string;
  view?: CouncilView;
}) {
  const access = useAppAccess();
  const { ready } = useAuthenticatedSession();
  const retry = useCallback(() => {
    access.refetch();
  }, [access]);
  const permission = access.data?.estates?.find(
    (estate) => estate.estateId === estateId
  );
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
        <ErrorState
          message={access.error.message}
          onRetry={retry}
          retryLabel="Retry access"
        />
      </PageLayout>
    );
  }
  const manager = permission?.canManageInvitationPermissions === true;
  if (
    !(
      permission &&
      (permission.canViewEstateInvitations ||
        permission.canInviteMembers ||
        manager)
    )
  ) {
    return (
      <PageLayout>
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            You do not have permission to invite members to this estate.
          </AlertDescription>
        </Alert>
      </PageLayout>
    );
  }
  return (
    <PageLayout className="space-y-6">
      {manager ? (
        <MembersWorkspace
          estateId={estateId}
          permission={permission}
          view={view}
        />
      ) : (
        <>
          <ListPageHeader
            actions={
              permission.canInviteMembers ? (
                <InviteMemberDialog estateId={estateId} />
              ) : null
            }
            icon={Users}
            title="Invitations"
          />
          <InactiveNote permission={permission} />
          <OwnerInvitations estateId={estateId} />
        </>
      )}
    </PageLayout>
  );
}
