import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import type { Page } from "./api";

export const fieldClass =
  "w-full rounded-md border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
export const cardClass =
  "min-w-0 rounded-xl border border-gray-200 bg-white p-5 sm:p-6";
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status === "Completed" ? "bg-emerald-100 text-emerald-800" : status === "Cancelled" ? "bg-red-100 text-red-800" : status === "SupportPaused" ? "bg-amber-100 text-amber-900" : "bg-blue-50 text-blue-800"}`}
    >
      {status}
    </span>
  );
}
export function PageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 [overflow-wrap:anywhere] sm:px-6">
      <header>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-gray-600">{description}</p>
        )}
      </header>
      {children}
    </div>
  );
}
export function Feedback({
  pending,
  error,
  empty,
}: {
  pending?: boolean;
  error?: Error | null;
  empty?: boolean;
}) {
  if (pending)
    return (
      <p className="p-5 text-gray-500" role="status">
        Loading…
      </p>
    );
  if (error)
    return (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
        {error.message}
      </p>
    );
  if (empty)
    return <p className="p-5 text-sm text-gray-500">Nothing here yet.</p>;
  return null;
}
export function Pagination({
  data,
  page,
  setPage,
}: {
  data?: Page<unknown>;
  page: number;
  setPage: (page: number) => void;
}) {
  if (!data || data.pagination.totalPages < 2) return null;
  return (
    <nav
      className="flex items-center justify-between gap-3 py-3"
      aria-label="Pagination"
    >
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm">
        Page {page} / {data.pagination.totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= data.pagination.totalPages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-6 shadow-xl backdrop:bg-black/50"
      aria-label={title}
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="my-4 text-sm leading-6 text-gray-600">{children}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Go back
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? "Processing…" : "Confirm"}
        </Button>
      </div>
    </dialog>
  );
}
