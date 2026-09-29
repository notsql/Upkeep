import { Spinner } from "@proj/ui/components/spinner";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      {/* Spinner is a labelled status, so screen readers announce loading. */}
      <Spinner className="size-6" />
    </div>
  );
}
