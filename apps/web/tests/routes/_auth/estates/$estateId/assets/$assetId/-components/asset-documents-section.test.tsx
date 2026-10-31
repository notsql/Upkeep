import { act, fireEvent } from "@testing-library/react";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import {
  allow,
  apiDelete,
  apiGet,
  apiPut,
  assetId,
  associationPath,
  attachmentsPath,
  documentId,
  estateId,
  failure,
  fixture,
  linked,
  listeners,
  openAssetDocuments,
  session,
  state,
  success,
  unlinkAction,
} from "@tests/fixtures/asset-documents";
import { screen, waitFor, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";

const DOCUMENTS_HEADING = /^documents$/i;
const INVOICE_FILENAME = /invoice\.pdf/i;
const INVOICE_CONFIRMATION = /invoice\.pdf/;
const INVOICE_TYPE = /^invoice$/i;
const UPLOAD_DATE = /25.*Oct|Oct.*25|2026-10-25|25\/10\/2026|10\/25\/2026/i;
const DOWNLOAD_INVOICE = /download invoice\.pdf/i;
const UNLINK_BUTTON = /unlink/i;
const ASSET_REFERENCE = /TT-A0001/;
const RETRY_BUTTON = /retry/i;
const NO_LINKED_DOCUMENTS = /no.*documents.*link|no.*linked.*documents/i;
const NEXT_PAGE = /^next(?: page)?$|load more/i;
const SECOND_FILENAME = /second\.pdf/i;

it("keeps the Size header aligned with the shared attachment row", async () => {
  linked();
  await openAssetDocuments("asset");
  const row = within(
    await screen.findByRole("row", { name: INVOICE_FILENAME })
  );
  screen.getByRole("columnheader", { name: "Size" });
  expect(row.getAllByRole("cell")).toHaveLength(5);
  row.getByRole("cell", { name: "100 bytes" });
});

it("shows linked document metadata and downloads from the authenticated content endpoint after a reload", async () => {
  linked();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:asset-document");
      static revokeObjectURL = vi.fn();
    }
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined
  );
  const { unmount } = await openAssetDocuments("asset");
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  const row = within(
    await screen.findByRole("row", { name: INVOICE_FILENAME })
  );
  row.getByRole("cell", { name: INVOICE_TYPE });
  row.getByRole("cell", { name: UPLOAD_DATE });
  fireEvent.click(row.getByRole("button", { name: DOWNLOAD_INVOICE }));
  await waitFor(() =>
    expect(apiGet).toHaveBeenCalledWith(
      "/estates/{estateId}/documents/{documentId}/content",
      expect.objectContaining({
        params: { path: { estateId, documentId } },
        parseAs: "blob",
      })
    )
  );
  unmount();
  await openAssetDocuments("asset");
  await screen.findByRole("row", { name: INVOICE_FILENAME });
});

it.each([false, true])(
  "allows unlink on the asset page when retired=%s and retains the uploaded document",
  async (retired) => {
    linked();
    fixture.retired = retired;
    await openAssetDocuments("asset");
    const row = within(
      await screen.findByRole("row", { name: INVOICE_FILENAME })
    );
    fireEvent.click(row.getByRole("button", { name: UNLINK_BUTTON }));
    const confirmation = within(await screen.findByRole("dialog"));
    confirmation.getByText(INVOICE_CONFIRMATION);
    confirmation.getByText(ASSET_REFERENCE);
    fireEvent.click(confirmation.getByRole("button", { name: unlinkAction }));
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith(
        associationPath,
        expect.objectContaining({
          body: { assetId: null, expectedAssociationVersion: 1 },
        })
      )
    );
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: INVOICE_FILENAME })).toBeNull()
    );
    expect(apiDelete).not.toHaveBeenCalled();
  }
);

it("keeps historical documents readable in an inactive estate and hides Unlink", async () => {
  linked();
  fixture.estateInactive = true;
  await openAssetDocuments("asset");
  await screen.findByRole("button", { name: DOWNLOAD_INVOICE });
  expect(screen.queryByRole("button", { name: UNLINK_BUTTON })).toBeNull();
});

it("does not request or display attachment metadata without document-read authority", async () => {
  linked();
  allow({ documents: false });
  await openAssetDocuments("asset");
  await screen.findByRole("heading", { name: "Water pump" });
  expect(screen.queryByRole("row", { name: INVOICE_FILENAME })).toBeNull();
  expect(apiGet.mock.calls.some(([path]) => path === attachmentsPath)).toBe(
    false
  );
});

it("offers Retry after attachment read failure and then displays the documents", async () => {
  linked();
  const original = apiGet.getMockImplementation();
  let failed = false;
  apiGet.mockImplementation((path, options) => {
    if (path === attachmentsPath && !failed) {
      failed = true;
      return Promise.resolve(failure("Unable to load asset documents", 500));
    }
    if (!original) {
      throw new Error("Missing HTTP fixture");
    }
    return original(path, options);
  });
  await openAssetDocuments("asset");
  await screen.findByText("Unable to load asset documents");
  fireEvent.click(screen.getByRole("button", { name: RETRY_BUTTON }));
  await screen.findByRole("row", { name: INVOICE_FILENAME });
  expect(apiPut).not.toHaveBeenCalled();
});

it("explains when the asset has no linked documents", async () => {
  await openAssetDocuments("asset");
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  await screen.findByText(NO_LINKED_DOCUMENTS);
});

it("removes private document metadata after document-read permission is revoked", async () => {
  linked();
  const { queryClient } = await openAssetDocuments("asset");
  await screen.findByRole("row", { name: INVOICE_FILENAME });
  allow({ documents: false });
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner", "app-access"] });
  });
  await waitFor(() =>
    expect(screen.queryByRole("row", { name: INVOICE_FILENAME })).toBeNull()
  );
});

it("does not show the previous accounts attachments after an account change", async () => {
  linked();
  await openAssetDocuments("asset");
  await screen.findByRole("row", { name: INVOICE_FILENAME });
  fixture.association.assetId = null;
  await act(() => {
    session.user = { id: "another-owner" };
    for (const listener of listeners) {
      listener();
    }
  });
  await waitFor(() =>
    expect(screen.queryByRole("row", { name: INVOICE_FILENAME })).toBeNull()
  );
  expect(apiGet).toHaveBeenCalledWith(
    attachmentsPath,
    expect.objectContaining({
      params: expect.objectContaining({ path: { estateId, assetId } }),
    })
  );
});

it("requests the next attachment page using the asset-scoped cursor", async () => {
  linked();
  const original = apiGet.getMockImplementation();
  apiGet.mockImplementation((path, options) => {
    if (path === attachmentsPath) {
      const request = options as { params?: { query?: { cursor?: string } } };
      if (request.params?.query?.cursor === "asset-next-page") {
        return Promise.resolve(
          success({
            items: [
              {
                id: "00000000-0000-0000-0000-000000000006",
                estateId,
                documentType: "SERVICE_REPORT",
                originalFilename: "second.pdf",
                contentType: "application/pdf",
                sizeBytes: 100,
                createdAt: "2026-10-24T01:00:00Z",
                canDelete: false,
              },
            ],
            nextCursor: null,
          })
        );
      }
      return Promise.resolve(
        success({
          items: [
            {
              id: documentId,
              estateId,
              documentType: "INVOICE",
              originalFilename: "invoice.pdf",
              contentType: "application/pdf",
              sizeBytes: 100,
              createdAt: "2026-10-25T01:00:00Z",
              canDelete: false,
            },
          ],
          nextCursor: "asset-next-page",
        })
      );
    }
    if (!original) {
      throw new Error("Missing HTTP fixture");
    }
    return original(path, options);
  });
  await openAssetDocuments("asset");
  await screen.findByRole("row", { name: INVOICE_FILENAME });
  fireEvent.click(screen.getByRole("button", { name: NEXT_PAGE }));
  await screen.findByRole("row", { name: SECOND_FILENAME });
  expect(apiGet).toHaveBeenCalledWith(
    attachmentsPath,
    expect.objectContaining({
      params: expect.objectContaining({
        path: { estateId, assetId },
        query: expect.objectContaining({ cursor: "asset-next-page" }),
      }),
    })
  );
});

it("does not carry private attachments into another estate", async () => {
  linked();
  const otherEstate = "00000000-0000-0000-0000-000000000007";
  const original = apiGet.getMockImplementation();
  apiGet.mockImplementation((path, options) => {
    const request = options as
      | { params?: { path?: { estateId?: string } } }
      | undefined;
    if (
      path === attachmentsPath &&
      request?.params?.path?.estateId === otherEstate
    ) {
      return Promise.resolve(success({ items: [], nextCursor: null }));
    }
    if (!original) {
      throw new Error("Missing HTTP fixture");
    }
    return original(path, options);
  });
  state.access = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [estateId, otherEstate].map((id) => ({
      ...ownerEstateAccess,
      estateId: id,
      canViewDocuments: true,
      canUploadDocuments: true,
    })),
  };
  const { router } = await openAssetDocuments("asset");
  await screen.findByRole("row", { name: INVOICE_FILENAME });
  await act(async () => {
    await router.navigate({
      href: `/estates/${otherEstate}/assets/${assetId}`,
    });
  });
  await waitFor(() =>
    expect(screen.queryByRole("row", { name: INVOICE_FILENAME })).toBeNull()
  );
  await screen.findByText(NO_LINKED_DOCUMENTS);
});
