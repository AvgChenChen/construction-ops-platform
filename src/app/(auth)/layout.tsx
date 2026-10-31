import { MarkIcon } from "@/components/ui/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-white">
            <MarkIcon size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Construction Ops</span>
        </div>
        <div className="card p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-ink-subtle">
          Open-source portfolio prototype. All companies and people in the demo data are fictional.
        </p>
      </div>
    </main>
  );
}
