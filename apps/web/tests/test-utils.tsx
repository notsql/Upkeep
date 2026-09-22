import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import type { ReactElement, ReactNode } from "react";

/**
 * Renders a component inside the same providers `__root.tsx` supplies.
 *
 * Anything calling `useQuery` or `useTheme` throws without them, so reach for
 * this instead of Testing Library's bare `render` whenever a component touches
 * data fetching or the theme.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  // A fresh client per test: a shared one would leak cached data between tests
  // and make them order-dependent.
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      // Retries turn an intentional failure case into a multi-second timeout.
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export { screen, waitFor, within } from "@testing-library/react";
