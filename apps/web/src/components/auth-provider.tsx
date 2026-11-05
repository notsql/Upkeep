import { env } from "@proj/env/web";
import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { AuthTokenBridge } from "@/components/auth-token-bridge";
import { AuthIdleGuard } from "@/routes/-components/auth-idle-guard";

/**
 * Wraps the app in WorkOS AuthKit.
 *
 * The TanStack Start adapter stores the WorkOS session in an encrypted,
 * HTTP-only cookie. Client hooks call its server functions and never receive
 * the refresh token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <AuthTokenBridge>
        <AuthIdleGuard timeoutMinutes={env.VITE_AUTH_IDLE_TIMEOUT_MINUTES}>
          {children}
        </AuthIdleGuard>
      </AuthTokenBridge>
    </AuthKitProvider>
  );
}
