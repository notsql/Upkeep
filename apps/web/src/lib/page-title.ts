export const APP_NAME = "UpKeep";

/** Browser tab title: "UpKeep", or "UpKeep · <Page>" when a page is given. */
export function pageTitle(page?: string): string {
  return page ? `${APP_NAME} · ${page}` : APP_NAME;
}

/** Route `head()` result carrying the formatted tab title. */
export function pageHead(page?: string): { meta: { title: string }[] } {
  return { meta: [{ title: pageTitle(page) }] };
}
