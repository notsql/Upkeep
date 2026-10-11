import type { components } from "@proj/api/schema";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import { type SubmitEvent, useCallback, useState } from "react";
import { FormActions } from "@/components/form-actions";

type EstateInput = components["schemas"]["EstateRequest"];

export function EstateForm({
  initialValues,
  onSave,
  onCancel,
}: {
  initialValues?: EstateInput | components["schemas"]["EstateResponse"];
  onCancel?: () => void;
  onSave: (values: EstateInput) => Promise<unknown>;
}) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      const values = new FormData(event.currentTarget);
      setPending(true);
      setError(undefined);
      try {
        await onSave({
          name: String(values.get("name") ?? ""),
          code: String(values.get("code") ?? ""),
          address: String(values.get("address") ?? ""),
          postalCode: String(values.get("postalCode") ?? ""),
          description: String(values.get("description") ?? ""),
        });
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save the estate. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [onSave, pending]
  );
  const submitLabel = initialValues ? "Save changes" : "Create estate";
  const buttonLabel = pending ? "Saving…" : submitLabel;
  return (
    <form className="form-surface mt-6 grid gap-5" onSubmit={handleSubmit}>
      <p className="text-muted-foreground text-sm">
        All fields are required unless marked optional.
      </p>
      <fieldset className="grid gap-5" disabled={pending}>
        <legend className="sr-only">Estate details</legend>
        <div className="grid gap-2">
          <Label htmlFor="estate-name">Name</Label>
          <Input
            defaultValue={initialValues?.name}
            id="estate-name"
            maxLength={200}
            name="name"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estate-code">Estate code</Label>
          <Input
            aria-describedby="estate-code-help"
            defaultValue={initialValues?.code}
            id="estate-code"
            maxLength={50}
            name="code"
            required
          />
          <p className="text-muted-foreground text-sm" id="estate-code-help">
            A unique identifier, such as MG-001. Saved in uppercase.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estate-address">Address</Label>
          <Input
            defaultValue={initialValues?.address}
            id="estate-address"
            maxLength={500}
            name="address"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estate-postal-code">Postal code</Label>
          <Input
            defaultValue={initialValues?.postalCode}
            id="estate-postal-code"
            maxLength={20}
            name="postalCode"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estate-description">Description (optional)</Label>
          <Textarea
            defaultValue={initialValues?.description ?? ""}
            id="estate-description"
            maxLength={2000}
            name="description"
          />
        </div>
      </fieldset>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <FormActions label={buttonLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}
