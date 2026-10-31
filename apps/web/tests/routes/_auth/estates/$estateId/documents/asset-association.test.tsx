import { act, fireEvent } from "@testing-library/react";
import {
  allow,
  apiDelete,
  apiGet,
  apiPut,
  asset,
  assetAction,
  assetId,
  assetsPath,
  associationPath,
  documentId,
  estateId,
  failure,
  fixture,
  linked,
  locationId,
  openAssetDocuments,
  saveAction,
  secondAssetId,
  selectAsset,
  unlinkAction,
} from "@tests/fixtures/asset-documents";
import { chooseOption, screen, waitFor, within } from "@tests/test-utils";
import { expect, it } from "vitest";

const INVOICE_CONFIRMATION = /invoice\.pdf/;
const DOWNLOAD_INVOICE = /download invoice\.pdf/i;
const ASSET_REFERENCE = /TT-A0001/;
const RETRY_BUTTON = /retry/i;
const RETIRED_STATUS = /retired/i;
const SEARCH_LABEL = /search/i;
const CATEGORY_LABEL = /^category$/i;
const LOCATION_LABEL = /^location$/i;
const CONDITION_LABEL = /^condition$/i;
const STATUS_LABEL = /^status$/i;
const SEARCH_BUTTON = /^search$/i;
const SELECTED_ASSET = /selected.*TT-A0001/i;
const CANCEL_BUTTON = /^cancel$/i;
const FILE_RETAINED = /file.*retain|file.*kept|keep.*file/i;
const CORRECTION_REASON = /correction reason/i;
const EMPTY_REGISTER = /no assets/i;
const NO_MATCHES = /no.*match/i;
const CLEAR_FILTERS = /clear/i;
const REFRESH_ASSOCIATION = /refresh association|refresh link/i;
const REVIEW_UPDATED = /reviewed.*updated|review.*updated/i;

const ASSOCIATE_ASSET = "Associate Asset";
const SELECT_SECOND_ASSET = /select TT-A0002/i;
const ASSET_LINK_ACTION = /(?:associate asset|unlink) for invoice\.pdf/i;

it("opens unlink confirmation directly from the Unlink button", async () => {
  linked();
  await openAssetDocuments();
  const unlink = await screen.findByRole("button", {
    name: "Unlink for invoice.pdf",
  });
  expect(unlink.textContent).toBe("Unlink");
  fireEvent.click(unlink);
  const confirmation = within(
    await screen.findByRole("dialog", { name: "Unlink document" })
  );
  confirmation.getByText(INVOICE_CONFIRMATION);
  confirmation.getByText(ASSET_REFERENCE);
  confirmation.getByText(FILE_RETAINED);
  expect(confirmation.queryByRole("checkbox")).toBeNull();
  expect(confirmation.queryByRole("button", { name: saveAction })).toBeNull();
  expect(apiPut).not.toHaveBeenCalled();
  fireEvent.click(confirmation.getByRole("button", { name: unlinkAction }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await screen.findByRole("button", { name: assetAction });
  expect(screen.queryByRole("link", { name: ASSET_REFERENCE })).toBeNull();
  expect(apiDelete).not.toHaveBeenCalled();
});

it("shows Associate Asset in the Asset column for an unlinked document", async () => {
  await openAssetDocuments();
  await screen.findByRole("columnheader", { name: "Asset" });
  const headers = screen.getAllByRole("columnheader");
  const assetColumn = headers.findIndex(
    (header) => header.textContent === "Asset"
  );
  expect(assetColumn).toBeGreaterThanOrEqual(0);
  const action = await screen.findByRole("button", { name: assetAction });
  const row = within(screen.getByRole("row", { name: INVOICE_CONFIRMATION }));
  expect(row.getAllByRole("cell")[assetColumn]).toBe(action.closest("td"));
  expect(row.queryByRole("link", { name: ASSET_REFERENCE })).toBeNull();
});

it("shows the associated asset link instead of Associate Asset in the Asset column", async () => {
  linked();
  await openAssetDocuments();
  const link = await screen.findByRole("link", { name: ASSET_REFERENCE });
  expect(link.getAttribute("href")).toBe(
    `/estates/${estateId}/assets/${assetId}`
  );
  const headers = screen.getAllByRole("columnheader");
  const assetColumn = headers.findIndex(
    (header) => header.textContent === "Asset"
  );
  const row = within(screen.getByRole("row", { name: INVOICE_CONFIRMATION }));
  expect(row.getAllByRole("cell")[assetColumn]).toBe(link.closest("td"));
  expect(row.queryByRole("button", { name: assetAction })).toBeNull();
});

it("replaces Associate Asset with the asset link after saving", async () => {
  const { dialog } = await openDialog();
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  fireEvent.click(dialog.getByRole("button", { name: saveAction }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await screen.findByRole("link", { name: ASSET_REFERENCE });
  expect(screen.queryByRole("button", { name: assetAction })).toBeNull();
});

it("labels the document action and dialog Associate Asset", async () => {
  await openAssetDocuments();
  const action = await screen.findByRole("button", { name: assetAction });
  expect(action.textContent).toBe(ASSOCIATE_ASSET);
  fireEvent.click(action);
  await screen.findByRole("dialog", { name: ASSOCIATE_ASSET });
});

it("keeps at most one asset checked and disables saving when the selection is unchecked", async () => {
  fixture.assets = [
    asset,
    { ...asset, id: secondAssetId, reference: "TT-A0002" },
  ];
  const { dialog } = await openDialog();
  const first = await dialog.findByRole("checkbox", { name: selectAsset });
  const second = dialog.getByRole("checkbox", { name: SELECT_SECOND_ASSET });
  const save = dialog.getByRole<HTMLButtonElement>("button", {
    name: saveAction,
  });
  expect(first.getAttribute("aria-checked")).toBe("false");
  expect(second.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(first);
  expect(first.getAttribute("aria-checked")).toBe("true");
  expect(save.disabled).toBe(false);
  fireEvent.click(second);
  expect(first.getAttribute("aria-checked")).toBe("false");
  expect(second.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(second);
  expect(second.getAttribute("aria-checked")).toBe("false");
  expect(save.disabled).toBe(true);
  expect(dialog.queryByText(SELECTED_ASSET)).toBeNull();
  expect(apiPut).not.toHaveBeenCalled();
  fireEvent.click(second);
  fireEvent.click(save);
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      associationPath,
      expect.objectContaining({
        body: { assetId: secondAssetId, expectedAssociationVersion: 0 },
      })
    )
  );
});

async function openDialog() {
  const view = await openAssetDocuments();
  fireEvent.click(
    await screen.findByRole("button", { name: ASSET_LINK_ACTION })
  );
  return { ...view, dialog: within(await screen.findByRole("dialog")) };
}

it("lets an asset editor link an ordinary upload without document-edit permission and retain it after reload", async () => {
  allow({ editDocuments: false });
  const { dialog, unmount } = await openDialog();
  const save = dialog.getByRole<HTMLButtonElement>("button", {
    name: saveAction,
  });
  expect(save.disabled).toBe(true);
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  dialog.getByText("invoice.pdf", { exact: false });
  expect(save.disabled).toBe(false);
  expect(apiPut).not.toHaveBeenCalled();
  fireEvent.click(save);
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      associationPath,
      expect.objectContaining({
        params: { path: { estateId, documentId } },
        body: { assetId, expectedAssociationVersion: 0 },
      })
    )
  );
  unmount();
  await openDialog();
  await within(await screen.findByRole("dialog")).findByText(ASSET_REFERENCE);
});

it("starts with the complete register including a labelled and selectable retired asset", async () => {
  fixture.assets = [{ ...asset, deactivatedAt: "2026-10-26T01:00:00Z" }];
  const { dialog } = await openDialog();
  await dialog.findByText(RETIRED_STATUS);
  const row = within(await dialog.findByRole("row", { name: ASSET_REFERENCE }));
  row.getByText("Water pump");
  row.getByText("Pump");
  row.getByText("Block A › Level 1");
  fireEvent.click(row.getByRole("checkbox", { name: selectAsset }));
  fireEvent.click(dialog.getByRole("button", { name: saveAction }));
  await waitFor(() =>
    expect(apiGet).toHaveBeenCalledWith(
      assetsPath,
      expect.objectContaining({
        params: expect.objectContaining({
          path: { estateId },
          query: expect.objectContaining({ status: "ALL" }),
        }),
      })
    )
  );
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      associationPath,
      expect.objectContaining({
        body: { assetId, expectedAssociationVersion: 0 },
      })
    )
  );
});

it("combines search and every register filter while retaining the selected UUID", async () => {
  fixture.assets = [
    asset,
    {
      ...asset,
      id: secondAssetId,
      reference: "TT-A0002",
      locationPath: "Block B",
    },
  ];
  const { dialog } = await openDialog();
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  fireEvent.change(dialog.getByRole("searchbox", { name: SEARCH_LABEL }), {
    target: { value: "water" },
  });
  await chooseOption(
    dialog.getByRole("combobox", { name: CATEGORY_LABEL }),
    "Pump"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: LOCATION_LABEL }),
    "Block A"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: CONDITION_LABEL }),
    "Not assessed yet"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: STATUS_LABEL }),
    "Retired"
  );
  fireEvent.click(dialog.getByRole("button", { name: SEARCH_BUTTON }));
  await waitFor(() =>
    expect(apiGet).toHaveBeenCalledWith(
      assetsPath,
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({
            q: "water",
            category: "PUMP",
            locationId,
            condition: "UNASSESSED",
            status: "INACTIVE",
          }),
        }),
      })
    )
  );
  dialog.getByText(SELECTED_ASSET);
  fireEvent.click(dialog.getByRole("button", { name: saveAction }));
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      associationPath,
      expect.objectContaining({
        body: { assetId, expectedAssociationVersion: 0 },
      })
    )
  );
});

it("Cancel closes a selected link confirmation without saving", async () => {
  const { dialog } = await openDialog();
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  fireEvent.click(dialog.getByRole("button", { name: CANCEL_BUTTON }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(apiPut).not.toHaveBeenCalled();
});

it("requires explicit unlink before choosing a different asset and retains the uploaded file", async () => {
  linked();
  const { dialog } = await openDialog();
  await dialog.findByText(ASSET_REFERENCE);
  expect(dialog.queryByRole("button", { name: saveAction })).toBeNull();
  const confirmation = within(await screen.findByRole("dialog"));
  confirmation.getByText(INVOICE_CONFIRMATION);
  confirmation.getByText(ASSET_REFERENCE);
  confirmation.getByText(FILE_RETAINED);
  expect(
    confirmation.queryByRole("textbox", { name: CORRECTION_REASON })
  ).toBeNull();
  fireEvent.click(confirmation.getByRole("button", { name: unlinkAction }));
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      associationPath,
      expect.objectContaining({
        body: { assetId: null, expectedAssociationVersion: 1 },
      })
    )
  );
  expect(apiDelete).not.toHaveBeenCalled();
  await screen.findByRole("button", { name: DOWNLOAD_INVOICE });
});

it("Cancel in unlink confirmation leaves the current link untouched", async () => {
  linked();
  const { dialog } = await openDialog();
  dialog.getByText(FILE_RETAINED);
  fireEvent.click(dialog.getByRole("button", { name: CANCEL_BUTTON }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await screen.findByRole("link", { name: ASSET_REFERENCE });
  expect(apiPut).not.toHaveBeenCalled();
  expect(apiDelete).not.toHaveBeenCalled();
});

it("does not expose an asset picker to a Manager with document-edit and inspection access alone", async () => {
  allow({ owner: false });
  await openAssetDocuments();
  await screen.findByRole("button", { name: DOWNLOAD_INVOICE });
  expect(screen.queryByRole("button", { name: assetAction })).toBeNull();
  expect(apiGet.mock.calls.some(([path]) => path === assetsPath)).toBe(false);
});

it.each([409, "network"])(
  "requires explicit review after %s without retrying a save",
  async (kind) => {
    if (kind === "network") {
      apiPut.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    } else {
      apiPut.mockResolvedValueOnce(
        failure("The association changed. Refresh and review.", 409)
      );
    }
    const { dialog } = await openDialog();
    fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
    fireEvent.click(dialog.getByRole("button", { name: saveAction }));
    await dialog.findByRole("alert");
    dialog.getByText(SELECTED_ASSET);
    expect(
      dialog.getByRole<HTMLButtonElement>("button", { name: saveAction })
        .disabled
    ).toBe(true);
    expect(apiPut).toHaveBeenCalledTimes(1);
  }
);

it("refreshes a conflicting association and requires review before any new save", async () => {
  apiPut.mockResolvedValueOnce(
    failure("The association changed. Refresh and review.", 409)
  );
  const { dialog } = await openDialog();
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  fireEvent.click(dialog.getByRole("button", { name: saveAction }));
  await dialog.findByRole("alert");
  linked(secondAssetId, 3);
  fireEvent.click(dialog.getByRole("button", { name: REFRESH_ASSOCIATION }));
  await dialog.findByRole("button", { name: REVIEW_UPDATED });
  expect(apiPut).toHaveBeenCalledTimes(1);
});

it("refreshes cached estate document lists after a confirmed link", async () => {
  const { dialog, queryClient } = await openDialog();
  const cachedSearch = [
    "owner",
    "documents",
    estateId,
    { filename: "invoice" },
  ];
  queryClient.setQueryData(cachedSearch, { items: [], nextCursor: null });
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  fireEvent.click(dialog.getByRole("button", { name: saveAction }));
  await waitFor(() =>
    expect(queryClient.getQueryState(cachedSearch)?.isInvalidated).toBe(true)
  );
});

it("shows loading while the asset register request is pending and cannot submit a link", async () => {
  const original = apiGet.getMockImplementation();
  apiGet.mockImplementation((path, options) => {
    if (path === assetsPath) {
      return new Promise(() => undefined);
    }
    if (!original) {
      throw new Error("Missing HTTP fixture");
    }
    return original(path, options);
  });
  const { dialog } = await openDialog();
  await dialog.findByRole("status");
  expect(dialog.queryByRole("checkbox", { name: selectAsset })).toBeNull();
  expect(
    dialog.getByRole<HTMLButtonElement>("button", { name: saveAction }).disabled
  ).toBe(true);
  expect(apiPut).not.toHaveBeenCalled();
});

it("does not silently retarget a pending unlink after another tab changes the asset", async () => {
  linked();
  const { dialog, queryClient } = await openDialog();
  dialog.getByText(FILE_RETAINED);
  linked(secondAssetId, 3);
  await act(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["owner", "documents", estateId],
    });
  });
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: unlinkAction,
    })
  );
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      associationPath,
      expect.objectContaining({
        body: { assetId: null, expectedAssociationVersion: 1 },
      })
    )
  );
});

it("keeps a selection after a correctable validation error", async () => {
  apiPut.mockResolvedValueOnce(
    failure("This selection cannot be saved. Check the asset.", 400)
  );
  const { dialog } = await openDialog();
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  fireEvent.click(dialog.getByRole("button", { name: saveAction }));
  await dialog.findByRole("alert");
  dialog.getByText(SELECTED_ASSET);
  expect(
    dialog.getByRole<HTMLButtonElement>("button", { name: saveAction }).disabled
  ).toBe(false);
});

it("does not request asset-owner estate details for a document-only user", async () => {
  allow({ owner: false });
  await openAssetDocuments();
  await screen.findByRole("button", { name: DOWNLOAD_INVOICE });
  expect(apiGet.mock.calls.map(([path]) => path)).not.toContain(
    "/estates/{id}"
  );
});

it("prevents duplicate submission while a link is pending", async () => {
  apiPut.mockImplementationOnce(() => new Promise(() => undefined));
  const { dialog } = await openDialog();
  fireEvent.click(await dialog.findByRole("checkbox", { name: selectAsset }));
  const save = dialog.getByRole<HTMLButtonElement>("button", {
    name: saveAction,
  });
  fireEvent.click(save);
  await waitFor(() => expect(save.disabled).toBe(true));
  fireEvent.click(save);
  expect(apiPut).toHaveBeenCalledTimes(1);
});

it("offers Retry for an association read failure without issuing a mutation", async () => {
  const original = apiGet.getMockImplementation();
  let failed = false;
  apiGet.mockImplementation((path, options) => {
    if (path === associationPath && !failed) {
      failed = true;
      return Promise.resolve(failure("Unable to load asset association", 500));
    }
    if (!original) {
      throw new Error("Missing HTTP fixture");
    }
    return original(path, options);
  });
  await openAssetDocuments();
  const row = within(
    await screen.findByRole("row", { name: INVOICE_CONFIRMATION })
  );
  await row.findByRole("alert");
  expect(row.queryByRole("button", { name: assetAction })).toBeNull();
  fireEvent.click(row.getByRole("button", { name: RETRY_BUTTON }));
  fireEvent.click(await row.findByRole("button", { name: assetAction }));
  const dialog = within(await screen.findByRole("dialog"));
  await dialog.findByRole("checkbox", { name: selectAsset });
  expect(apiPut).not.toHaveBeenCalled();
});

it("distinguishes an empty register from a search with no matches and clearing restores all assets", async () => {
  fixture.assets = [];
  const { dialog } = await openDialog();
  await dialog.findByText(EMPTY_REGISTER);
  fireEvent.change(dialog.getByRole("searchbox", { name: SEARCH_LABEL }), {
    target: { value: "missing" },
  });
  fireEvent.click(dialog.getByRole("button", { name: SEARCH_BUTTON }));
  await dialog.findByText(NO_MATCHES);
  fixture.assets = [asset];
  fireEvent.click(dialog.getByRole("button", { name: CLEAR_FILTERS }));
  await dialog.findByRole("checkbox", { name: selectAsset });
  await waitFor(() =>
    expect(apiGet).toHaveBeenLastCalledWith(
      assetsPath,
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({ status: "ALL" }),
        }),
      })
    )
  );
});

it("removes association write controls when current asset authority is revoked", async () => {
  const { dialog, queryClient } = await openDialog();
  await dialog.findByRole("checkbox", { name: selectAsset });
  allow({ owner: false });
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner", "app-access"] });
  });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: saveAction })).toBeNull()
  );
  expect(apiPut).not.toHaveBeenCalled();
});
