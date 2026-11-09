import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@proj/ui/components/field";
import { Textarea } from "@proj/ui/components/textarea";
import { type SubmitEvent, useCallback, useState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { FormCard } from "@/components/page/form-page";
import { EstateFormAddressFields } from "@/routes/_auth/estates/-components/estate-editor-page/estate-form/estate-form-address-fields";
import { EstateFormIdentityFields } from "@/routes/_auth/estates/-components/estate-editor-page/estate-form/estate-form-identity-fields";

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
    <FormCard>
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <FieldDescription>
          All fields are required unless marked optional.
        </FieldDescription>
        <FieldSet disabled={pending}>
          <FieldLegend>Identity</FieldLegend>
          <EstateFormIdentityFields
            code={initialValues?.code}
            name={initialValues?.name}
          />
        </FieldSet>
        <FieldSeparator />
        <FieldSet disabled={pending}>
          <FieldLegend>Address</FieldLegend>
          <EstateFormAddressFields
            address={initialValues?.address}
            postalCode={initialValues?.postalCode}
          />
          <Field>
            <FieldLabel htmlFor="estate-description">
              Description (optional)
            </FieldLabel>
            <Textarea
              defaultValue={initialValues?.description ?? ""}
              id="estate-description"
              maxLength={2000}
              name="description"
            />
          </Field>
        </FieldSet>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <FormActions
          label={buttonLabel}
          onCancel={onCancel}
          pending={pending}
        />
      </form>
    </FormCard>
  );
}
