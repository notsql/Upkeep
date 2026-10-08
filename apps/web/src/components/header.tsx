import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";

import { AuthButton } from "./auth-button";
import { EstateSwitcher } from "./estates/estate-switcher";

export default function Header() {
  return (
    <header className="app-topbar">
      <nav
        aria-label="Header navigation"
        className="flex items-center gap-5 text-sm"
      >
        <Link className="font-semibold text-lg tracking-tight" to="/">
          UpKeep
        </Link>
      </nav>
      <div className="topbar-controls">
        <EstateSwitcher />
        <ThemeToggle />
        <AuthButton />
      </div>
    </header>
  );
}
