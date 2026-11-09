import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";

export function EstateFormAddressFields({
  address,
  postalCode,
}: {
  address: string | undefined;
  postalCode: string | undefined;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="estate-address">Address</FieldLabel>
        <Input
          defaultValue={address}
          id="estate-address"
          maxLength={500}
          name="address"
          required
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="estate-postal-code">Postal code</FieldLabel>
        <Input
          defaultValue={postalCode}
          id="estate-postal-code"
          maxLength={20}
          name="postalCode"
          required
        />
      </Field>
    </>
  );
}
