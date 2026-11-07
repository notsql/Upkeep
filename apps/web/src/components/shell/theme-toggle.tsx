import { Button } from "@proj/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const changeTheme = useCallback(
    () => setTheme(dark ? "light" : "dark"),
    [dark, setTheme]
  );
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Button
      aria-label={label}
      disabled={!mounted}
      onClick={changeTheme}
      size="icon"
      title={label}
      variant="ghost"
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
