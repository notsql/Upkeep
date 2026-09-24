import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { startServerSignOut } from "@/lib/auth-redirect";

const ACTIVITY_EVENTS = [
  "keydown",
  "pointerdown",
  "scroll",
  "touchstart",
] as const;

export function AuthIdleGuard({
  children,
  timeoutMinutes,
}: {
  children: ReactNode;
  timeoutMinutes: number;
}) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const signOutAfterInactivity = () => {
      startServerSignOut("/login");
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(
        signOutAfterInactivity,
        timeoutMinutes * 60 * 1000
      );
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [timeoutMinutes, user]);

  return children;
}
