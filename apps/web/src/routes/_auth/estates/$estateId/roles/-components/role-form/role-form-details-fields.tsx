import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Field, FieldLabel } from "@proj/ui/components/field";
import { Input } from "@proj/ui/components/input";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";

export function RoleFormDetailsFields({
  description,
  id,
  name,
  onDescriptionChange,
  onNameChange,
  pending,
}: {
  description: string;
  id: string;
  name: string;
  onDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Details</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>Role name</FieldLabel>
          <Input
            disabled={pending}
            id={`${id}-name`}
            maxLength={40}
            onChange={onNameChange}
            required
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <Textarea
            disabled={pending}
            id={`${id}-description`}
            maxLength={500}
            onChange={onDescriptionChange}
            value={description}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
