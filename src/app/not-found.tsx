import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        This page doesn&apos;t exist, or it belongs to a different company account.
      </p>
      <Link href="/dashboard" className="btn-primary mt-8">
        Back to dashboard
      </Link>
    </main>
  );
}
