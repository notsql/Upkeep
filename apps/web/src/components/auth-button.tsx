import { Button, buttonVariants } from "@proj/ui/components/button";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

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
        Log in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">{user.email}</span>
      <a
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href="/logout"
      >
        Sign out
      </a>
    </div>
  );
}
