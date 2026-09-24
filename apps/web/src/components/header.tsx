import { env } from "@proj/env/web";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos-inc/authkit-react";

import { AuthButton } from "./auth-button";

function AuthKitNavigationLink() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return null;
  }

  return user ? (
    <Link to="/account">Account</Link>
  ) : (
    <Link to="/register">Register</Link>
  );
}

function AuthenticationNavigationLink() {
  if (!env.VITE_WORKOS_CLIENT_ID) {
    return <Link to="/register">Register</Link>;
  }

  return <AuthKitNavigationLink />;
}

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          <Link to="/">Home</Link>
          <AuthenticationNavigationLink />
        </nav>
        <div className="flex items-center gap-2">
          <AuthButton />
        </div>
      </div>
      <hr />
    </div>
  );
}
