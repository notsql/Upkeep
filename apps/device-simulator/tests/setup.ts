import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when a global `afterEach` exists, and we run
// without Vitest globals - so unmount explicitly.
afterEach(() => {
  cleanup();
});
