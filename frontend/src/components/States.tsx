import type { ReactNode } from "react";

export function Loading({ label = "Loading releases" }: { label?: string }) {
  return (
    <div className="state" aria-busy="true">
      <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p><strong>Couldn't load data.</strong> {message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
