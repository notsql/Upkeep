/**
 * The one mapping from a status tone to its badge and dot classes, so an
 * active asset, an online device and every other "good" status share the
 * same green, and every failing status the same destructive red.
 */
export type StatusTone = "success" | "danger" | "neutral" | "muted";

export const statusToneClassName: Record<StatusTone, string> = {
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  neutral: "border-border text-foreground",
  muted: "bg-secondary text-secondary-foreground",
};

export const statusDotClassName: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/50",
  muted: "bg-muted-foreground/30",
};
