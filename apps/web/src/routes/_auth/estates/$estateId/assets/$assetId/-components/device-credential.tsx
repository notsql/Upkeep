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
import {
  type Device,
  type DeviceCredential as IssuedCredential,
  useIssueDeviceCredential,
} from "@/lib/devices";

/**
 * A device's credential status and, while the asset is active, Generate or
 * Replace credential. A new key is held only in this component's state until
 * its dialog closes; it is never cached (decision 0025).
 */
export function DeviceCredential({
  assetId,
  canManage,
  device,
  estateId,
}: {
  assetId: string;
  canManage: boolean;
  device: Device;
  estateId: string;
}) {
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
          : "Unable to generate a credential. Please try again."
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
  const cancelOnClose = useCallback((open: boolean) => {
    if (!open) {
      setConfirming(false);
    }
  }, []);
  const done = useCallback(() => setIssued(undefined), []);
  const doneOnClose = useCallback((open: boolean) => {
    if (!open) {
      setIssued(undefined);
    }
  }, []);
  const copy = useCallback(async () => {
    if (!issued) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issued.apiKey);
      toast.success("API key copied.");
    } catch {
      setError("Unable to copy. Select the key and copy it manually.");
    }
  }, [issued]);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>
        {device.credentialIssuedAt
          ? `Credential issued ${new Date(device.credentialIssuedAt).toLocaleString()}`
          : "No credential"}
      </span>
      {canManage ? (
        <Button
          disabled={issue.isPending}
          onClick={start}
          size="sm"
          variant="outline"
        >
          {hasCredential ? "Replace credential" : "Generate credential"}
        </Button>
      ) : null}
      {error && !issued ? (
        <p className="w-full text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog onOpenChange={cancelOnClose} open={confirming}>
        <DialogContent className="p-6 sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="font-semibold text-xl">
              Replace the credential for {device.identifier}?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              The current key stops working immediately. The device cannot send
              readings until it is given the new key.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={cancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button onClick={generate} type="button" variant="destructive">
              Replace credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={doneOnClose} open={Boolean(issued)}>
        <DialogContent className="p-6 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="font-semibold text-xl">
              API key for {device.identifier}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              Copy this key into the device now. It won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`api-key-${device.id}`}>API key</Label>
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
    </div>
  );
}
