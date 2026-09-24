import { useAuth } from "@workos-inc/authkit-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { startSignOut } from "@/lib/auth-session";

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
  const { signOut, user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const signOutAfterInactivity = () => {
      startSignOut(signOut, `${window.location.origin}/login`);
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
  }, [signOut, timeoutMinutes, user]);

  return children;
}
