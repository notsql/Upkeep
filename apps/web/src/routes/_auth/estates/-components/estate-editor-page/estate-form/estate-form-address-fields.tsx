import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";

export function EstateFormAddressFields({
  address,
  postalCode,
}: {
  address: string | undefined;
  postalCode: string | undefined;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="estate-address">Address</Label>
        <Input
          defaultValue={address}
          id="estate-address"
          maxLength={500}
          name="address"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="estate-postal-code">Postal code</Label>
        <Input
          defaultValue={postalCode}
          id="estate-postal-code"
          maxLength={20}
          name="postalCode"
          required
        />
      </div>
    </>
  );
}
