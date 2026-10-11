import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { LogOut, Settings, UserRound } from "lucide-react";

export function AuthButton() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <Button disabled size="sm" variant="ghost">
        Loading...
      </Button>
    );
  }

  if (!user) {
    return (
      <a className={buttonVariants({ size: "sm" })} href="/api/auth/sign-in">
        Sign in
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open account menu"
            className="profile-menu-trigger"
            size="icon"
            variant="outline"
          />
        }
      >
        <UserRound aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-2"
        sideOffset={8}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="break-all">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 text-sm"
            render={<Link to="/account" />}
          >
            <Settings aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 text-sm"
            render={<a href="/logout" />}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
