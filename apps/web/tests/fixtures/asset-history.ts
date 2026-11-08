import type { components } from "@proj/api/schema";

export const historyAsset: components["schemas"]["AssetHistorySummaryResponse"] =
  {
    id: "pump",
    reference: "E-A0001",
    name: "Water pump",
    category: "PUMP",
    locationPath: "Block A › Pump room",
    installedOn: null,
    retiredOn: null,
    status: "ACTIVE",
  };
export const historyInvoice: components["schemas"]["DocumentResponse"] = {
  id: "invoice",
  estateId: "estate",
  originalFilename: "report.pdf",
  documentType: "INVOICE",
  contentType: "application/pdf",
  sizeBytes: 20,
  createdAt: "2026-03-01T16:30:00Z",
  canDelete: false,
};
export const invoiceEntry: components["schemas"]["AssetHistoryEntryResponse"] =
  {
    id: "INVOICE:invoice",
    sourceId: "invoice",
    kind: "INVOICE",
    title: "Invoice uploaded",
    summary: "report.pdf",
    occurredOn: null,
    occurredAt: historyInvoice.createdAt,
    recordedAt: historyInvoice.createdAt,
    details: { kind: "DOCUMENT", document: historyInvoice },
  };
export const conditionEntry: components["schemas"]["AssetHistoryEntryResponse"] =
  {
    id: "CONDITION:condition",
    sourceId: "condition",
    kind: "CONDITION",
    title: "Condition assessed",
    summary: "Vibration increased",
    occurredOn: "2026-03-01",
    occurredAt: null,
    recordedAt: "2026-03-02T01:00:00Z",
    details: {
      kind: "CONDITION",
      condition: "NEEDS_ATTENTION",
      assessedOn: "2026-03-01",
      notes: "Vibration increased",
      origin: "ANOMALY_MODEL",
      sourceLabel: "Anomaly detection",
    },
  };
export const historyPage: components["schemas"]["AssetHistoryPageResponse"] = {
  asset: historyAsset,
  items: [invoiceEntry, conditionEntry],
  nextCursor: null,
  documentsVisible: true,
};
