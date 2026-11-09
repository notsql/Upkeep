import { Field, FieldDescription, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";

export function EstateFormIdentityFields({
  name,
  code,
}: {
  name: string | undefined;
  code: string | undefined;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="estate-name">Name</FieldLabel>
        <Input
          defaultValue={name}
          id="estate-name"
          maxLength={200}
          name="name"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="estate-code">MCST number</FieldLabel>
        <Input
          aria-describedby="estate-code-help"
          defaultValue={code}
          id="estate-code"
          inputMode="numeric"
          maxLength={50}
          name="code"
          placeholder="e.g. 1234"
          required
        />
        <FieldDescription id="estate-code-help">
          The Management Corporation Strata Title number. Enter the number only,
          without "MCST".
        </FieldDescription>
      </Field>
    </>
  );
}
