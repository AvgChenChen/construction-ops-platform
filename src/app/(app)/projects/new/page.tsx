import { createProjectAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/forms";
import { ProjectFields } from "@/components/project-fields";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/current";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireUser();
  return (
    <>
      <PageHeader
        title="New project"
        description="Add the basics now. Tasks and subcontractors come next."
        back={{ href: "/projects", label: "Projects" }}
      />
      <Card className="max-w-3xl">
        <ActionForm
          action={createProjectAction}
          submitLabel="Create project"
          pendingLabel="Creating…"
          resetOnSuccess={false}
        >
          <ProjectFields />
        </ActionForm>
      </Card>
    </>
  );
}
