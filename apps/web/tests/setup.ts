import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when a global `afterEach` exists, and we run
// without Vitest globals - so unmount explicitly. Without this, components from
// earlier tests stay in the document and queries match the wrong node.
afterEach(() => {
  cleanup();
});
