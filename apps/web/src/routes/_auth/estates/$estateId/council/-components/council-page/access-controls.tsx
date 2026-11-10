import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Mail, SearchX } from "lucide-react";
import { useCallback } from "react";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail aria-hidden="true" className="text-muted-foreground size-4" />
          <h2>Pending invitations</h2>
          {invitations.data ? (
            <Badge variant={badgeVariantFor(invitationTone.PENDING)}>
              {invitations.data.length} pending
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>Not yet accepted</CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.isPending ? (
          <LoadingState label="Loading invitations…" />
        ) : null}
        {invitations.error ? (
          <ErrorState message={invitations.error.message} onRetry={retry} />
        ) : null}
        {invitations.data?.length === 0 ? (
          <EmptyState
            description="Sent invitations appear here"
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
      </CardContent>
    </Card>
  );
}
