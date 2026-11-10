import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Mail, SearchX } from "lucide-react";
import { useCallback } from "react";
import { PageSection } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useOutstandingInvitations } from "@/lib/council-invitations";
import { badgeVariantFor, invitationTone } from "@/lib/status-tone";
import {
  type MemberFilter,
  matchesFilter,
} from "@/routes/_auth/estates/$estateId/council/-components/council-page/member-filters";
import { OutstandingInvitation } from "@/routes/_auth/estates/$estateId/council/-components/council-page/outstanding-invitation";

export function OwnerInvitations({
  estateId,
  filter,
  onClear,
}: {
  estateId: string;
  filter?: MemberFilter;
  onClear?: () => void;
}) {
  const invitations = useOutstandingInvitations(estateId);
  const retry = useCallback(() => {
    invitations.refetch();
  }, [invitations]);
  const visible = (invitations.data ?? []).filter((invitation) =>
    filter
      ? matchesFilter(filter, {
          text: [invitation.email],
          role: invitation.customRoleId ?? invitation.role,
        })
      : true
  );
  return (
    <PageSection
      actions={
        invitations.data ? (
          <Badge variant={badgeVariantFor(invitationTone.PENDING)}>
            {invitations.data.length} pending
          </Badge>
        ) : null
      }
      description="Not yet accepted"
      icon={Mail}
      title="Pending invitations"
    >
      {invitations.isPending ? (
        <LoadingState label="Loading invitations…" />
      ) : null}
      {invitations.error ? (
        <ErrorState message={invitations.error.message} onRetry={retry} />
      ) : null}
      {invitations.data?.length === 0 ? (
        <EmptyState
          description="Sent invitations appear here"
          fill
          icon={Mail}
          title="No pending invitations"
        />
      ) : null}
      {invitations.data?.length && !visible.length ? (
        <EmptyState
          action={
            onClear ? (
              <Button onClick={onClear} variant="outline">
                Clear filters
              </Button>
            ) : undefined
          }
          description="Try another search or role"
          fill
          icon={SearchX}
          title="No matching invitations"
        />
      ) : null}
      {visible.length ? (
        <ul aria-label="Outstanding invitations" className="divide-y">
          {visible.map((invitation) => (
            <OutstandingInvitation
              estateId={estateId}
              invitation={invitation}
              key={invitation.id}
            />
          ))}
        </ul>
      ) : null}
    </PageSection>
  );
}
