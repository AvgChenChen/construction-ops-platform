import { prisma } from "@/lib/db";
import { parseISODate } from "@/lib/domain/calendar";
import type { Ctx } from "@/server/services/context";
import { createProject } from "@/server/services/projects";
import { createTask } from "@/server/services/tasks";
import { createSubcontractor } from "@/server/services/subcontractors";
import { hashPassword } from "@/server/auth/password";

let passwordHash: string | null = null;

export async function resetDatabase() {
  // Every tenant table cascades from Organization.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Organization" CASCADE');
}

export async function makeOrganization(name: string) {
  passwordHash ??= await hashPassword("integration-test-password");
  const org = await prisma.organization.create({ data: { name } });
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "-");
  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: `${name} Owner`,
      email: `owner@${slug}.example`,
      role: "OWNER",
      passwordHash,
    },
  });
  const member = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: `${name} Member`,
      email: `member@${slug}.example`,
      role: "MEMBER",
      passwordHash,
    },
  });
  const ownerCtx: Ctx = { userId: owner.id, orgId: org.id, role: "OWNER" };
  const memberCtx: Ctx = { userId: member.id, orgId: org.id, role: "MEMBER" };
  return { org, owner, member, ownerCtx, memberCtx };
}

/** Plumbing done, electrical in progress, drywall waiting on both. */
export async function makeRenovation(ctx: Ctx, start = "2026-11-02") {
  const project = await createProject(ctx, { name: "Test Renovation", address: "1 Test Street", startDate: start });
  const electrician = await createSubcontractor(ctx, {
    companyName: "Test Electric",
    trade: "ELECTRICAL",
    contactName: "E. Lectric",
  });
  const plumbing = await createTask(ctx, project.id, {
    name: "Plumbing rough-in",
    trade: "PLUMBING",
    plannedStart: start,
    durationDays: 3,
    dependsOn: [],
  });
  const electrical = await createTask(ctx, project.id, {
    name: "Electrical rough-in",
    trade: "ELECTRICAL",
    plannedStart: start,
    durationDays: 4,
    subcontractorId: electrician.id,
    dependsOn: [],
  });
  const drywall = await createTask(ctx, project.id, {
    name: "Drywall",
    trade: "DRYWALL",
    plannedStart: "2026-11-06",
    durationDays: 5,
    dependsOn: [plumbing.id, electrical.id],
  });
  return { project, electrician, plumbing, electrical, drywall };
}

export const d = parseISODate;
