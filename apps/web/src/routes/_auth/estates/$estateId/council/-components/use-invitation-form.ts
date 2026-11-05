import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import {
  useCouncilInvitation,
  useEstateInvitationRoles,
} from "@/lib/council-invitations";
import {
  type RoleOption,
  roleSelection,
  roleValue,
} from "@/routes/_auth/estates/$estateId/council/-components/role-picker";

function getSelectedRole(
  options: RoleOption[],
  selection: string | undefined
): RoleOption | undefined {
  if (selection !== undefined) {
    return options.find((option) => roleValue(option) === selection);
  }
  return options.find((option) => option.role === "COUNCIL") ?? options[0];
}
export function useInvitationForm(
  estateId: string,
  initialRole: string | undefined
) {
  const invitation = useCouncilInvitation(estateId);
  const choices = useEstateInvitationRoles(estateId);
  const [email, setEmail] = useState("");
  const [selection, setSelection] = useState<string | undefined>(initialRole);
  const selected = getSelectedRole(choices.data ?? [], selection);
  const retry = useCallback(() => {
    choices.refetch();
  }, [choices]);
  const changeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value),
    []
  );
  const changeRole = useCallback(
    (option: RoleOption) => setSelection(roleValue(option)),
    []
  );
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (invitation.isPending || !selected) {
        return;
      }
      invitation.mutate(
        { email: email.trim(), ...roleSelection(selected) },
        { onSuccess: () => setEmail("") }
      );
    },
    [invitation, selected, email]
  );
  return {
    changeEmail,
    changeRole,
    choices,
    email,
    invitation,
    retry,
    selected,
    submit,
  };
}
