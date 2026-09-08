import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      {/* Announce loading to screen readers - an unlabelled spinner is silent. */}
      <Loader2 aria-label="Loading" className="animate-spin" role="status" />
    </div>
  );
}
