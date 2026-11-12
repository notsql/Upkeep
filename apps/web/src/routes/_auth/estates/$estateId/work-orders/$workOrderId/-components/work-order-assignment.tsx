import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@proj/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@proj/ui/components/popover";
import { UserRound } from "lucide-react";
import { useCallback, useState } from "react";
import { PageSection } from "@/components/page/section-card";
import { useRetryDispatch, useWorkOrderDispatch } from "@/lib/report-routing";
import {
  type AssignTarget,
  useAssignWorkOrder,
  useWorkOrderAssignees,
  type WorkOrder,
  type WorkOrderAssignee,
} from "@/lib/work-orders";

interface Choice {
  name: string;
  note: string;
  target: NonNullable<AssignTarget>;
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function assigneeLabel(assignee: WorkOrderAssignee): string {
  if (assignee.kind === "MEMBER" && !assignee.inEstate) {
    return `${assignee.name} (no longer in this estate)`;
  }
  return assignee.name;
}

/** "Email sent" / "Email didn't go through" for the contractor who has the job now. */
function EmailStatus({
  estateId,
  order,
  canRetry,
}: {
  estateId: string;
  order: WorkOrder;
  canRetry: boolean;
}) {
  const dispatch = useWorkOrderDispatch(estateId, order.id);
  const retry = useRetryDispatch(estateId);
  const tryAgain = useCallback(() => retry.mutate(order.id), [retry, order.id]);
  const email = dispatch.data;
  if (!email || email.contractorName !== order.assignee?.name) {
    return null;
  }
  if (email.status === "SENT") {
    return <p className="text-muted-foreground text-sm">Email sent</p>;
  }
  if (email.status === "PENDING") {
    return <p className="text-muted-foreground text-sm">Sending email…</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Email didn't go through</span>
      {canRetry ? (
        <Button
          disabled={retry.isPending}
          onClick={tryAgain}
          size="sm"
          variant="outline"
        >
          Try again
        </Button>
      ) : null}
      {retry.isError ? <span role="alert">{retry.error.message}</span> : null}
    </div>
  );
}

function AssigneePicker({
  estateId,
  label,
  onChoose,
}: {
  estateId: string;
  label: string;
  onChoose: (choice: Choice) => void;
}) {
  const [open, setOpen] = useState(false);
  const candidates = useWorkOrderAssignees(estateId, open);
  const choose = useCallback(
    (choice: Choice) => {
      setOpen(false);
      onChoose(choice);
    },
    [onChoose]
  );
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={<Button variant="outline" />}>
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <p className="px-3 pt-3 text-sm font-medium">Who should do this job?</p>
        <Command>
          <CommandInput placeholder="Search by name or email" />
          <CommandList>
            {candidates.isPending ? (
              <p className="p-3 text-sm">Loading…</p>
            ) : null}
            {candidates.isError ? (
              <p className="p-3 text-sm" role="alert">
                {candidates.error.message}
              </p>
            ) : null}
            <CommandEmpty>Nobody matches that search.</CommandEmpty>
            {candidates.data ? (
              <>
                <CommandGroup heading="Your team">
                  {candidates.data.members.map((member) => (
                    <MemberItem
                      key={member.userId}
                      member={member}
                      onChoose={choose}
                    />
                  ))}
                </CommandGroup>
                <CommandGroup heading="Contractors">
                  {candidates.data.contractors.map((contractor) => (
                    <ContractorItem
                      contractor={contractor}
                      key={contractor.id}
                      onChoose={choose}
                    />
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type Candidates = NonNullable<ReturnType<typeof useWorkOrderAssignees>["data"]>;

function MemberItem({
  member,
  onChoose,
}: {
  member: Candidates["members"][number];
  onChoose: (choice: Choice) => void;
}) {
  const select = useCallback(
    () =>
      onChoose({
        target: { userId: member.userId },
        name: member.name,
        note: `${firstName(member.name)} will see this in their notifications.`,
      }),
    [member, onChoose]
  );
  return (
    <CommandItem
      onSelect={select}
      value={`member:${member.userId} ${member.name}`}
    >
      <span>{member.name}</span>
      <span className="text-muted-foreground ml-auto text-xs">
        {member.role === "CREW" ? "Crew" : "Manager"}
      </span>
    </CommandItem>
  );
}

function ContractorItem({
  contractor,
  onChoose,
}: {
  contractor: Candidates["contractors"][number];
  onChoose: (choice: Choice) => void;
}) {
  const select = useCallback(
    () =>
      onChoose({
        target: { providerId: contractor.id },
        name: contractor.name,
        note: `We'll email ${contractor.name} the job details.`,
      }),
    [contractor, onChoose]
  );
  return (
    <CommandItem
      onSelect={select}
      value={`contractor:${contractor.id} ${contractor.name} ${contractor.email}`}
    >
      <span className="flex flex-col">
        <span>{contractor.name}</span>
        <span className="text-muted-foreground text-xs">
          {contractor.email}
        </span>
      </span>
    </CommandItem>
  );
}

/** Who has the job, and (for owners and Managers) the control to give it to someone else. */
export function WorkOrderAssignment({
  estateId,
  order,
  canAssign,
}: {
  estateId: string;
  order: WorkOrder;
  canAssign: boolean;
}) {
  const assign = useAssignWorkOrder(estateId, order.id);
  const [choice, setChoice] = useState<Choice | null>(null);
  const editable = canAssign && order.status !== "CLOSED";
  const confirm = useCallback(() => {
    if (choice) {
      assign.mutate(
        { target: choice.target, version: order.version },
        { onSuccess: () => setChoice(null) }
      );
    }
  }, [assign, choice, order.version]);
  const cancel = useCallback(() => setChoice(null), []);
  const remove = useCallback(
    () => assign.mutate({ target: null, version: order.version }),
    [assign, order.version]
  );
  const { assignee } = order;
  return (
    <PageSection icon={UserRound} title="Assigned to">
      <div className="grid gap-3">
        {assignee ? (
          <div className="grid gap-1">
            <p className="font-medium">{assigneeLabel(assignee)}</p>
            {assignee.email ? (
              <p className="text-muted-foreground text-sm wrap-anywhere">
                {assignee.email}
              </p>
            ) : null}
            {assignee.kind === "CONTRACTOR" ? (
              <EmailStatus
                canRetry={canAssign}
                estateId={estateId}
                order={order}
              />
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">Nobody yet</p>
        )}
        {choice ? (
          <div className="grid gap-2 rounded-md border p-3">
            <p>Give this job to {choice.name}?</p>
            <p className="text-muted-foreground text-sm">{choice.note}</p>
            <div className="flex gap-2">
              <Button disabled={assign.isPending} onClick={confirm}>
                Give job
              </Button>
              <Button onClick={cancel} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {editable && !choice ? (
          <div className="flex flex-wrap gap-2">
            <AssigneePicker
              estateId={estateId}
              label={assignee ? "Change" : "Assign"}
              onChoose={setChoice}
            />
            {assignee ? (
              <Button
                disabled={assign.isPending}
                onClick={remove}
                variant="outline"
              >
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
        {assign.isError ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>{assign.error.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </PageSection>
  );
}
