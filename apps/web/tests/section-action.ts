import { expect } from "vitest";

/** Section header actions lead with a decorative (aria-hidden) lucide icon. */
export function expectLeadingIcon(action: HTMLElement): void {
  const icon = action.firstElementChild;
  expect(icon?.tagName.toLowerCase()).toBe("svg");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
}
