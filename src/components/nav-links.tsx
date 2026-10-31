"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderIcon, LayoutIcon, UsersIcon } from "./ui/icons";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutIcon },
  { href: "/projects", label: "Projects", Icon: FolderIcon },
  { href: "/subcontractors", label: "Subcontractors", Icon: UsersIcon },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid grid-cols-3 gap-1 md:flex md:flex-col">
      {LINKS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-10 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium whitespace-nowrap transition-colors md:justify-start md:px-3 ${
              active ? "bg-primary-soft text-primary" : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {active ? (
              <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-accent md:block" aria-hidden />
            ) : null}
            <Icon size={18} className="hidden sm:block" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
