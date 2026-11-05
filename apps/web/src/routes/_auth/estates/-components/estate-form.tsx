import type { components } from "@proj/api/schema";
import { Card, CardContent } from "@proj/ui/components/card";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import { type SubmitEvent, useCallback, useState } from "react";
import { FormActions } from "@/components/form-actions";
import { EstateFormAddressFields } from "@/routes/_auth/estates/-components/estate-form-address-fields";
import { EstateFormIdentityFields } from "@/routes/_auth/estates/-components/estate-form-identity-fields";

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
    <Card className="mt-6">
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <p className="text-muted-foreground text-sm">
            All fields are required unless marked optional.
          </p>
          <fieldset className="grid gap-5" disabled={pending}>
            <legend className="sr-only">Estate details</legend>
            <EstateFormIdentityFields
              code={initialValues?.code}
              name={initialValues?.name}
            />
            <EstateFormAddressFields
              address={initialValues?.address}
              postalCode={initialValues?.postalCode}
            />
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
          <FormActions
            label={buttonLabel}
            onCancel={onCancel}
            pending={pending}
          />
        </form>
      </CardContent>
    </Card>
  );
}
