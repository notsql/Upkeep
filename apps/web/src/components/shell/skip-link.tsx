import { buttonVariants } from "@proj/ui/components/button";

export function SkipLink() {
  return (
    <a
      className={buttonVariants({
        className:
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50",
      })}
      href="#main-content"
    >
      Skip to content
    </a>
  );
}
