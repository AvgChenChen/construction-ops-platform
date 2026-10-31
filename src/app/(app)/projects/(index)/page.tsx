import Link from "next/link";
import { projectProgress } from "@/lib/domain/blockers";
import { formatDate } from "@/lib/domain/calendar";
import { PlusIcon } from "@/components/ui/icons";
import { Badge, EmptyState, PageHeader, ProgressBar, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/current";
import { listProjects } from "@/server/services/projects";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const archived = params.status === "archived";
  const q = params.q?.trim() ?? "";
  const projects = await listProjects(user, archived ? "ARCHIVED" : "ACTIVE", q);
  const tab = (key: "active" | "archived") =>
    `rounded-sm px-3 py-1 text-sm ${(key === "archived") === archived ? "bg-primary-soft font-medium text-primary" : "text-ink-muted hover:text-ink"}`;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project your company is running or has archived."
        actions={
          <Link href="/projects/new" className="btn-primary">
            <PlusIcon /> New project
          </Link>
        }
      />
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
          <nav aria-label="Project status" className="flex rounded-md border border-line p-0.5">
            <Link
              href={`/projects${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className={tab("active")}
              aria-current={!archived ? "true" : undefined}
            >
              Active
            </Link>
            <Link
              href={`/projects?status=archived${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={tab("archived")}
              aria-current={archived ? "true" : undefined}
            >
              Archived
            </Link>
          </nav>
          <form action="/projects" method="get" role="search" className="flex gap-2">
            {archived ? <input type="hidden" name="status" value="archived" /> : null}
            <label htmlFor="q" className="sr-only">
              Search projects
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="Search name or address" className="input w-64" />
            <button type="submit" className="btn-secondary">
              Search
            </button>
          </form>
        </div>
        {projects.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={
                q
                  ? `No ${archived ? "archived" : "active"} projects match “${q}”`
                  : archived
                    ? "No archived projects"
                    : "No active projects yet"
              }
            />
          </div>
        ) : (
          <Table label="Projects" minWidth={760}>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Started</Th>
                <Th className="w-56">Progress</Th>
                <Th className="text-right">Subcontractors</Th>
                <Th className="text-right">Open issues</Th>
              </tr>
            </thead>
            <tbody data-testid="project-list">
              {projects.map((p) => {
                const progress = projectProgress(p.tasks);
                return (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <Td>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-ink-subtle">{p.address}</div>
                      {archived ? (
                        <div className="mt-1">
                          <Badge>Archived</Badge>
                        </div>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-muted tabular">{formatDate(p.startDate)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={progress} label={`${p.name} progress`} />
                        <span className="w-10 text-right text-xs text-ink-muted tabular">{progress}%</span>
                      </div>
                    </Td>
                    <Td className="text-right text-ink-muted tabular">{p._count.subcontractors}</Td>
                    <Td className="text-right text-ink-muted tabular">{p._count.issues}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}
