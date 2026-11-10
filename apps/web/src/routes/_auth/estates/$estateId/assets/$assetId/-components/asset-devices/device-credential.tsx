import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
  type Device,
  type DeviceCredential as IssuedCredential,
  useIssueDeviceCredential,
} from "@/lib/devices";

/**
 * Generate or Replace credential for one device. A new key is held only in
 * this hook's state until its dialog closes; it is never cached (decision
 * 0025). The row's action menu calls `start`; `DeviceCredentialDialogs`
 * renders the confirmation and the one-time key reveal.
 */
export function useDeviceCredential(
  estateId: string,
  assetId: string,
  device: Device
) {
  const issue = useIssueDeviceCredential(estateId, assetId);
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<IssuedCredential>();
  const [error, setError] = useState<string>();
  const hasCredential = Boolean(device.credentialIssuedAt);

  const generate = useCallback(async () => {
    setConfirming(false);
    setError(undefined);
    try {
      setIssued(await issue.mutateAsync(device.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't create a connection key. Try again."
      );
    }
  }, [issue.mutateAsync, device.id]);
  const start = useCallback(() => {
    if (hasCredential) {
      setConfirming(true);
      return;
    }
    generate();
  }, [hasCredential, generate]);
  const cancel = useCallback(() => setConfirming(false), []);
  const done = useCallback(() => setIssued(undefined), []);
  const copy = useCallback(async () => {
    if (!issued) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issued.apiKey);
      toast.success("Connection key copied.");
    } catch {
      setError("Couldn't copy the key. Select it and copy it yourself.");
    }
  }, [issued]);

  return {
    actionLabel: hasCredential
      ? "Replace connection key"
      : "Get connection key",
    cancel,
    confirming,
    copy,
    done,
    error,
    generate,
    issued,
    pending: issue.isPending,
    start,
  };
}

export type DeviceCredentialState = ReturnType<typeof useDeviceCredential>;

export function DeviceCredentialDialogs({
  credential,
  device,
}: {
  credential: DeviceCredentialState;
  device: Device;
}) {
  const { cancel, confirming, copy, done, error, generate, issued } =
    credential;
  const doneOnClose = useCallback(
    (open: boolean) => {
      if (!open) {
        done();
      }
    },
    [done]
  );
  return (
    <>
      {error && !issued ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        confirmLabel="Replace connection key"
        description="The current key stops working straight away. The sensor can't send readings until you give it the new key."
        onCancel={cancel}
        onConfirm={generate}
        open={confirming}
        title={`Replace the connection key for ${device.identifier}?`}
      />

      <Dialog onOpenChange={doneOnClose} open={Boolean(issued)}>
        <DialogContent className="p-6 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Connection key for {device.identifier}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              Copy this key into the sensor now. We won't show it again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`api-key-${device.id}`}>Connection key</Label>
            <div className="flex gap-2">
              <Input
                className="font-mono"
                id={`api-key-${device.id}`}
                readOnly
                value={issued?.apiKey ?? ""}
              />
              <Button onClick={copy} type="button" variant="outline">
                Copy
              </Button>
            </div>
            {error ? (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={done} type="button">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
