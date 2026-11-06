import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";

export function EstateFormIdentityFields({
  name,
  code,
}: {
  name: string | undefined;
  code: string | undefined;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="estate-name">Name</Label>
        <Input
          defaultValue={name}
          id="estate-name"
          maxLength={200}
          name="name"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="estate-code">MCST number</Label>
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
        <p className="text-muted-foreground text-sm" id="estate-code-help">
          The Management Corporation Strata Title number. Enter the number only,
          without "MCST".
        </p>
      </div>
    </>
  );
}
