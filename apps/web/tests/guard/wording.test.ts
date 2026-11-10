import { describe, expect, it } from "vitest";
import { visibleStrings } from "./visible-strings";

/** Words the plain-English wording spec keeps off the screen. */
const BANNED =
  /anomal|flatline|suspect|metric|credential|timestamp|unable to|\bscore/iu;

/**
 * Hits that remain until their phase of plain-english-wording.md rewords
 * them, as [file under src, visible text]. Each phase deletes its entries;
 * never add one for new code.
 */
const ALLOWED: [string, string][] = [];

describe("on-screen wording", () => {
  it("keeps code and statistics words off the screen", () => {
    const allowed = new Set(ALLOWED.map(([file, text]) => `${file}|${text}`));
    const hits = visibleStrings(`${process.cwd()}/src`)
      .filter(({ text }) => BANNED.test(text))
      .map(({ file, text }) => `${file}|${text}`)
      .filter((hit) => !allowed.has(hit));
    expect(hits).toEqual([]);
  });

  it("has no stale allow-list entries", () => {
    const found = new Set(
      visibleStrings(`${process.cwd()}/src`).map(
        ({ file, text }) => `${file}|${text}`
      )
    );
    const stale = ALLOWED.map(([file, text]) => `${file}|${text}`).filter(
      (entry) => !found.has(entry)
    );
    expect(stale).toEqual([]);
  });
});
