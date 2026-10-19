import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { Textarea } from "@proj/ui/components/textarea";
import type { ChangeEvent } from "react";

export function ReportDetailsFields({
  id,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: {
  id: string;
  title: string;
  description: string;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          aria-describedby={`${id}-title-help`}
          id={`${id}-title`}
          maxLength={50}
          onChange={onTitleChange}
          value={title}
        />
        <p className="text-muted-foreground text-sm" id={`${id}-title-help`}>
          Give the fault a short title in up to 50 characters.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <Textarea
          id={`${id}-description`}
          maxLength={2500}
          onChange={onDescriptionChange}
          value={description}
        />
        <p className="text-muted-foreground text-sm">
          Describe the fault in up to 2,500 characters.
        </p>
      </div>
    </>
  );
}
