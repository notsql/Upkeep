import { Link } from "@tanstack/react-router";

import { AuthButton } from "./auth-button";

export default function Header() {
  const links = [
    { label: "Home", to: "/" },
    { label: "Register", to: "/register" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AuthButton />
        </div>
      </div>
      <hr />
    </div>
  );
}
