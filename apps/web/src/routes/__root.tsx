import { Toaster } from "@proj/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "../components/auth-provider";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "UpKeep",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  const { queryClient } = Route.useRouteContext();

  return (
    // next-themes sets the theme class on <html> before React hydrates, so the
    // server and client markup differ by design - hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
          enableSystem
        >
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <AppShell>
                <Outlet />
              </AppShell>
              <Toaster richColors />
              <TanStackRouterDevtools position="bottom-left" />
            </QueryClientProvider>
          </AuthProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
