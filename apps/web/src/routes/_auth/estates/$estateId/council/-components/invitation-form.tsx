import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Send } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { roleValue } from "@/routes/_auth/estates/$estateId/council/-components/role-picker";
import { InvitationFormOutcome } from "./invitation-form-outcome";
import { InvitationRolePicker } from "./invitation-role-picker";
import { useInvitationForm } from "./use-invitation-form";

export function CouncilInvitationForm({
  estateId,
  initialRole,
}: {
  estateId: string;
  initialRole?: string;
}) {
  const {
    changeEmail,
    changeRole,
    choices,
    email,
    invitation,
    retry,
    selected,
    submit,
  } = useInvitationForm(estateId, initialRole);
  return (
    <div className="grid gap-3">
      {choices.isPending ? (
        <LoadingState label="Loading invitation roles…" rows={2} />
      ) : null}
      {choices.error ? (
        <ErrorState
          message={choices.error.message}
          onRetry={retry}
          retryLabel="Retry invitation roles"
        />
      ) : null}
      {choices.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">No eligible roles</p>
      ) : null}
      {choices.data && !choices.isError ? (
        <form className="grid gap-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="council-email">Email</Label>
            <Input
              disabled={invitation.isPending}
              id="council-email"
              maxLength={254}
              onChange={changeEmail}
              required
              type="email"
              value={email}
            />
          </div>
          <InvitationRolePicker
            disabled={
              invitation.isPending || !choices.data?.length || choices.isError
            }
            estateId={estateId}
            onChange={changeRole}
            options={choices.data ?? []}
            value={selected ? roleValue(selected) : ""}
          />
          <Button
            className="justify-self-end"
            disabled={
              invitation.isPending ||
              !email.trim() ||
              !selected ||
              choices.isError
            }
            type="submit"
          >
            <Send aria-hidden="true" />
            {invitation.isPending ? "Sending invitation…" : "Send invitation"}
          </Button>
          <InvitationFormOutcome invitation={invitation} />
        </form>
      ) : null}
    </div>
  );
}
