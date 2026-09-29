import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  type RenderOptions,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import type { ReactElement, ReactNode } from "react";
import { expect } from "vitest";

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

/**
 * Picks an option from a shadcn `Select`, given its trigger (the element with
 * role "combobox").
 *
 * base-ui ignores a click that lands straight after the popup opens - it guards
 * against the opening press selecting whatever is under the pointer - so the
 * click is retried until the popup closes on the chosen value.
 */
export async function chooseOption(
  trigger: HTMLElement,
  name: string | RegExp
): Promise<void> {
  fireEvent.click(trigger);
  const option = await screen.findByRole("option", { name });
  await waitFor(() => {
    fireEvent.click(option);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
}

export { screen, waitFor, within } from "@testing-library/react";
