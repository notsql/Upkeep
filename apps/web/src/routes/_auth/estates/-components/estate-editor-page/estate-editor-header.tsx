import { FormPageHeader } from "@/components/page/form-page-header";

export function EstateEditorHeader({ editing }: { editing: boolean }) {
  // Estate settings is a top-level estate section, so it has no breadcrumbs.
  if (editing) {
    return (
      <FormPageHeader
        breadcrumbs={[]}
        description="Identity and address"
        title="Estate settings"
      />
    );
  }
  return (
    <FormPageHeader
      breadcrumbs={[
        { label: "Estates", to: "/estates" },
        { label: "Create estate" },
      ]}
      description="Identity and address"
      title="Create estate"
    />
  );
}
