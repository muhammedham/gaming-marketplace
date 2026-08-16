import { LoaderCircle } from "lucide-react";

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading">
      <LoaderCircle className="size-6 animate-spin text-emerald-700" aria-hidden="true" />
    </div>
  );
}
