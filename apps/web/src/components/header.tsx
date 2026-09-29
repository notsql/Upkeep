import { Separator } from "@proj/ui/components/separator";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

import { AuthButton } from "./auth-button";
import { EstateSwitcher } from "./estates/estate-switcher";

const ADMIN_ROLE = "admin";
function AuthenticationNavigationLink() {
  const { loading, role, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Link to="/register">Register</Link>;
  }

  return (
    <>
      <Link to="/estates">My estates</Link>
      <Link to="/account">Account</Link>
      {role === ADMIN_ROLE ? (
        <Link to="/admin/users">Admin Dashboard</Link>
      ) : null}
    </>
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
      <Separator />
    </div>
  );
}
