import { updateProjectAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/forms";
import { ProjectFields } from "@/components/project-fields";
import { Card, PageHeader } from "@/components/ui/primitives";
import { orNotFound, requireUser } from "@/server/auth/current";
import { getProjectDetail } from "@/server/services/projects";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await orNotFound(getProjectDetail(user, projectId));
  return (
    <>
      <PageHeader
        title="Edit project"
        description={project.name}
        back={{ href: `/projects/${project.id}`, label: project.name }}
      />
      <Card className="max-w-3xl">
        <ActionForm
          action={updateProjectAction.bind(null, project.id)}
          submitLabel="Save changes"
          resetOnSuccess={false}
        >
          <ProjectFields defaults={project} />
        </ActionForm>
      </Card>
    </>
  );
}
