"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-muted">
        The error was logged on the server{error.digest ? ` (reference ${error.digest})` : ""}. You can try again.
      </p>
      <button onClick={reset} className="btn-primary mt-8">
        Try again
      </button>
    </div>
  );
}
