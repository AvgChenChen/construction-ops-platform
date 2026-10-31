import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { LogOutIcon, MarkIcon } from "@/components/ui/icons";
import { requireUser } from "@/server/auth/current";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-line bg-raised md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="md:sticky md:top-0 md:flex md:h-screen md:flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-4 md:block md:px-4 md:py-6">
            <Link href="/dashboard" className="flex items-center gap-2 px-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-white">
                <MarkIcon size={18} />
              </span>
              <span className="font-semibold tracking-tight">Construction Ops</span>
            </Link>
            <span className="rounded-sm bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-warning-ink md:mt-4 md:ml-2 md:inline-block">
              Prototype
            </span>
          </div>
          <div className="px-4 pb-4 md:flex-1 md:pb-0">
            <NavLinks />
          </div>
          <div className="hidden border-t border-line px-6 py-4 md:block">
            <p className="truncate text-sm font-medium" data-testid="current-user">
              {user.name}
            </p>
            <p className="truncate text-xs text-ink-subtle">{user.organizationName}</p>
            <p className="text-xs text-ink-subtle">{user.role === "OWNER" ? "Owner" : "Member"}</p>
            <form action={logoutAction} className="mt-2">
              <button type="submit" className="btn-ghost btn-sm -ml-3">
                <LogOutIcon size={14} /> Sign out
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between border-t border-line px-6 py-2 text-xs text-ink-subtle md:hidden">
            <span>
              {user.name} · {user.role === "OWNER" ? "Owner" : "Member"}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 md:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
