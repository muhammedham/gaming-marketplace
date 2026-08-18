import { AlertCircle, LoaderCircle, PackageSearch } from "lucide-react";
import type { ReactNode } from "react";

interface MarketplaceStateProps {
  kind: "loading" | "empty" | "error";
  title: string;
  description: string;
  action?: ReactNode;
}

export function MarketplaceState({ kind, title, description, action }: MarketplaceStateProps) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "error" ? AlertCircle : PackageSearch;

  return (
    <div className="flex min-h-64 flex-col items-center justify-center border-y border-gray-200 px-4 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-md bg-gray-100 text-gray-600">
        <Icon className={kind === "loading" ? "size-5 animate-spin" : "size-5"} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
