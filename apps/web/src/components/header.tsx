import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Header({ start }: { start?: ReactNode }) {
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {start}
        <nav
          aria-label="Header navigation"
          className="flex items-center gap-5 text-sm"
        >
          <Link className="text-lg font-semibold tracking-tight" to="/">
            UpKeep
          </Link>
        </nav>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <ThemeToggle />
        <AuthButton />
      </div>
    </header>
  );
}
