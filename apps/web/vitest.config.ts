import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Deliberately separate from vite.config.ts.
 *
 * The app config loads the TanStack Start and Cloudflare plugins, which exist to
 * build the SSR Worker. Component tests run in jsdom and don't need any of
 * that - loading it only slows the suite down and drags server-side concerns
 * into unit tests. React transform and path aliases are all that's required.
 */
export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    // Vite 8 resolves the `paths` in tsconfig.json natively - `@/*` and
    // `@proj/ui/*` work in tests exactly as they do in the app.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    // Base UI interaction tests exceed Vitest's five-second default timeout
    // when many jsdom workers compete with the Java suite for CPU.
    maxWorkers: 2,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // Undo spies/stubs between tests so state can't leak across them.
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
