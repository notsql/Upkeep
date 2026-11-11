import type { components } from "@proj/api/schema";

export type UploadSlot = components["schemas"]["UploadSlotResponse"];
export type SignedLink = components["schemas"]["SignedDownloadResponse"];

/** Refetch a signed link this long before it expires. */
const LINK_REFRESH_MARGIN_MS = 30_000;

/**
 * Sends one file straight to private storage using an upload slot from our API.
 * This is the one sanctioned raw `fetch` in the app: the target is the storage
 * provider's signed URL, not our API, so the typed client does not apply. The
 * headers must match the ones the URL was signed over.
 */
export async function sendToStorage(
  slot: UploadSlot,
  file: File
): Promise<void> {
  const response = await fetch(slot.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": slot.contentType,
      "x-goog-content-length-range": `0,${slot.maxBytes}`,
    },
    body: file,
  }).catch((cause: unknown) => {
    throw new Error(
      "Couldn't send the file. Check your connection and try again.",
      {
        cause,
      }
    );
  });
  if (!response.ok) {
    throw new Error("Couldn't send the file. Try again.");
  }
}

/** How long a fetched link stays fresh: until just before it expires. */
export function linkStaleTime(link: SignedLink | undefined): number {
  if (!link) {
    return 0;
  }
  return Math.max(
    0,
    Date.parse(link.expiresAt) - Date.now() - LINK_REFRESH_MARGIN_MS
  );
}
