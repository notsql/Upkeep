import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Deliberately separate from vite.config.ts, as in apps/web: tests run in
 * jsdom and must not load the TanStack Start plugin.
 */
export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
