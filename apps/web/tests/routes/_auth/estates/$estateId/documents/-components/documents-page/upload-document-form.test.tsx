import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { UploadDocumentForm } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/upload-document-form";

vi.mock(
  "@/routes/_auth/estates/$estateId/documents/-components/documents-page/use-upload-document-form",
  () => ({
    useUploadDocumentForm: () => ({
      changeFile: vi.fn(),
      changeType: vi.fn(),
      close: vi.fn(),
      documentType: "SERVICE_REPORT",
      error: undefined,
      submit: vi.fn(),
      upload: { isPending: false },
    }),
  })
);

it("names the chosen document type in words, not its code", async () => {
  renderWithProviders(
    <UploadDocumentForm
      estateId="estate"
      onClose={vi.fn()}
      onUploaded={vi.fn()}
      open
    />
  );
  const type = await screen.findByRole("combobox", { name: "Document type" });
  expect(type.textContent).toContain("Service report");
  expect(type.textContent).not.toContain("SERVICE_REPORT");
});
