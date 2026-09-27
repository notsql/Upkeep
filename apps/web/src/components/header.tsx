import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

import { AuthButton } from "./auth-button";
import { EstateSwitcher } from "./estates/estate-switcher";

function AuthenticationNavigationLink() {
  const { loading, user } = useAuth();

  if (loading) {
    return null;
  }

  return user ? (
    <>
      <Link to="/estates">My estates</Link>
      <Link to="/account">Account</Link>
    </>
  ) : (
    <Link to="/register">Register</Link>
  );
}

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          <Link to="/">Home</Link>
          <AuthenticationNavigationLink />
        </nav>
        <div className="flex items-center gap-4">
          <EstateSwitcher />
          <AuthButton />
        </div>
      </div>
      <hr />
    </div>
  );
}
