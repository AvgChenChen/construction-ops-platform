"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { cookies } from "next/headers";
import type { z } from "zod";
import {
  fieldErrors,
  followUpSchema,
  formDataToObject,
  issueSchema,
  loginSchema,
  progressSchema,
  projectSchema,
  reviewSchema,
  signUpSchema,
  subcontractorSchema,
  taskSchema,
} from "@/lib/validation";
import { safeNextPath } from "@/lib/safe-redirect";
import { clearSessionCookie, requireUser, SESSION_COOKIE, setSessionCookie } from "@/server/auth/current";
import { authenticate, createSession, invalidateSession, signUp } from "@/server/services/auth";
import { AppError } from "@/server/services/errors";
import { createProject, setProjectArchived, updateProject } from "@/server/services/projects";
import {
  addSubcontractorToProject,
  createSubcontractor,
  removeSubcontractorFromProject,
} from "@/server/services/subcontractors";
import { addDependency, createTask, recordProgress, removeDependency, updateTask } from "@/server/services/tasks";
import { createIssue, resolveIssue } from "@/server/services/issues";
import { createFollowUp, reviewFollowUp } from "@/server/services/followups";
import { errorFields, log } from "@/server/log";
import { createHash } from "node:crypto";

/** Log an email as a short hash so failed-login logs don't collect addresses. */
const emailRef = (email: string) => createHash("sha256").update(email).digest("hex").slice(0, 12);

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/** Server actions are public HTTP endpoints. Each one authenticates, validates, then calls a service. */
async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (error) {
    unstable_rethrow(error); // let redirect() and notFound() through
    if (error instanceof AppError) {
      if (error.code === "FORBIDDEN" || error.code === "RATE_LIMITED") log.warn("action.denied", { code: error.code });
      return { error: error.message, fieldErrors: error.fieldErrors };
    }
    log.error("action.unhandled_error", errorFields(error));
    return { error: "Something went wrong. Please try again." };
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new AppError("VALIDATION", "Please fix the highlighted fields.", fieldErrors(result.error));
  return result.data;
}

const refreshProject = (projectId: string) => {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
};

// ---------- Auth ----------

export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const state = await run(async () => {
    const input = parse(signUpSchema, formDataToObject(formData));
    const user = await signUp(input);
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
  });
  if (state.ok) redirect("/dashboard");
  return state;
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const state = await run(async () => {
    const input = parse(loginSchema, formDataToObject(formData));
    const user = await authenticate(input.email, input.password);
    if (!user) {
      log.warn("auth.login_failed", { emailRef: emailRef(input.email) });
      throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
    }
    log.info("auth.login", { userId: user.id });
    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);
  });
  if (state.ok) redirect(safeNextPath(formData.get("next")));
  return state;
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  redirect("/login");
}

// ---------- Projects ----------

export async function createProjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let projectId = "";
  const state = await run(async () => {
    const ctx = await requireUser();
    projectId = (await createProject(ctx, parse(projectSchema, formDataToObject(formData)))).id;
  });
  if (state.ok) redirect(`/projects/${projectId}`);
  return state;
}

export async function updateProjectAction(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const state = await run(async () => {
    const ctx = await requireUser();
    await updateProject(ctx, projectId, parse(projectSchema, formDataToObject(formData)));
  });
  if (state.ok) {
    refreshProject(projectId);
    redirect(`/projects/${projectId}`);
  }
  return state;
}

export async function setProjectArchivedAction(projectId: string, archived: boolean): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    await setProjectArchived(ctx, projectId, archived);
    refreshProject(projectId);
    revalidatePath("/projects");
    return archived ? "Project archived" : "Project restored";
  });
}

// ---------- Subcontractors ----------

export async function createSubcontractorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    const sub = await createSubcontractor(ctx, parse(subcontractorSchema, formDataToObject(formData)));
    revalidatePath("/subcontractors");
    return `Added ${sub.companyName}`;
  });
}

export async function addProjectSubcontractorAction(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    const subcontractorId = String(formData.get("subcontractorId") ?? "");
    if (!subcontractorId) throw new AppError("VALIDATION", "Choose a subcontractor");
    await addSubcontractorToProject(ctx, projectId, subcontractorId);
    refreshProject(projectId);
    return "Subcontractor added";
  });
}

export async function removeProjectSubcontractorAction(
  projectId: string,
  subcontractorId: string,
): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    await removeSubcontractorFromProject(ctx, projectId, subcontractorId);
    refreshProject(projectId);
  });
}

// ---------- Tasks ----------

export async function createTaskAction(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    const task = await createTask(ctx, projectId, parse(taskSchema, formDataToObject(formData, ["dependsOn"])));
    refreshProject(projectId);
    return `Added "${task.name}"`;
  });
}

export async function updateTaskAction(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    const input = parse(taskSchema.omit({ dependsOn: true }), formDataToObject(formData));
    const task = await updateTask(ctx, taskId, input);
    refreshProject(task.projectId);
    revalidatePath(`/projects/${task.projectId}/tasks/${taskId}`);
    return "Task updated";
  });
}

export async function addDependencyAction(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    const dependsOnId = String(formData.get("dependsOnId") ?? "");
    if (!dependsOnId) throw new AppError("VALIDATION", "Choose a task");
    await addDependency(ctx, taskId, dependsOnId);
    revalidatePath("/", "layout");
    return "Dependency added";
  });
}

export async function removeDependencyAction(taskId: string, dependsOnId: string): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    await removeDependency(ctx, taskId, dependsOnId);
    revalidatePath("/", "layout");
  });
}

export async function recordProgressAction(taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    await recordProgress(ctx, taskId, parse(progressSchema, formDataToObject(formData)));
    revalidatePath("/", "layout");
    return "Progress recorded";
  });
}

// ---------- Issues and follow-ups ----------

export async function createIssueAction(projectId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    await createIssue(ctx, projectId, parse(issueSchema, formDataToObject(formData)));
    refreshProject(projectId);
    return "Issue opened";
  });
}

export async function resolveIssueAction(issueId: string): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    const issue = await resolveIssue(ctx, issueId);
    refreshProject(issue.projectId);
  });
}

export async function createFollowUpAction(
  projectId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    await createFollowUp(ctx, projectId, parse(followUpSchema, formDataToObject(formData)));
    refreshProject(projectId);
    return "Follow-up drafted and waiting for approval";
  });
}

export async function reviewFollowUpAction(
  followUpId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireUser();
    // Bound arguments come back from the browser, so re-validate them like any other input.
    const input = parse(reviewSchema, { decision });
    await reviewFollowUp(ctx, followUpId, input.decision);
    revalidatePath("/", "layout");
    return input.decision === "APPROVED" ? "Approved" : "Rejected";
  });
}
