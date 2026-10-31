/**
 * Fictional demo data. Every company, person, address, and phone number here is invented
 * (phone numbers use the reserved 555-01xx range, emails use example domains).
 *
 * Dates are computed relative to "today" so the demo always shows the same situation:
 * plumbing rough-in is finished, electrical rough-in is late, and drywall is coming up
 * but can't start until the electrical work and the rough-in inspection are done.
 */
import { PrismaClient, type Trade, type TaskStatus } from "@prisma/client";
import { addWorkingDays, nextWorkingDayOnOrAfter, plannedEndFor, todayInTimeZone } from "../src/lib/domain/calendar";
import { hashPassword } from "../src/server/auth/password";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=true to override.");
  }
  const password = process.env.SEED_DEMO_PASSWORD ?? "demo-password-2026";
  const passwordHash = await hashPassword(password);
  const today = todayInTimeZone(process.env.APP_TIMEZONE ?? "America/Toronto");
  const D = nextWorkingDayOnOrAfter(today);
  const wd = (n: number) => addWorkingDays(D, n);
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

  // Deleting organizations cascades to every tenant-owned row.
  await prisma.organization.deleteMany();

  // ---------------- Northline Builders (main demo tenant) ----------------
  const northline = await prisma.organization.create({ data: { name: "Northline Builders (fictional)" } });
  const dana = await prisma.user.create({
    data: {
      organizationId: northline.id,
      name: "Dana Okafor",
      email: "dana@northline.example",
      role: "OWNER",
      passwordHash,
    },
  });
  const sam = await prisma.user.create({
    data: {
      organizationId: northline.id,
      name: "Sam Rivera",
      email: "sam@northline.example",
      role: "MEMBER",
      passwordHash,
    },
  });

  const subSpecs: [string, Trade, string, string][] = [
    ["Ironbark Demolition", "DEMOLITION", "Marco Silva", "416-555-0101"],
    ["Cedarline Framing", "FRAMING", "Jenna Hughes", "416-555-0102"],
    ["Bluewater Plumbing", "PLUMBING", "Tom Adeyemi", "416-555-0103"],
    ["Brightwire Electric", "ELECTRICAL", "Priya Nair", "416-555-0104"],
    ["Northwind HVAC", "HVAC", "Luis Ortega", "416-555-0105"],
    ["Summit Insulation", "INSULATION", "Grace Kim", "416-555-0106"],
    ["Trueline Drywall", "DRYWALL", "Owen Murphy", "416-555-0107"],
    ["Fresh Coat Painting", "PAINTING", "Aisha Rahman", "416-555-0108"],
    ["Oakline Floors", "FLOORING", "Ben Kowalski", "416-555-0109"],
    ["Keystone Millwork", "FINISH_CARPENTRY", "Chloe Martin", "416-555-0110"],
  ];
  const subs: Record<string, string> = {};
  for (const [companyName, trade, contactName, phone] of subSpecs) {
    const slug = companyName.split(" ")[0].toLowerCase();
    const s = await prisma.subcontractor.create({
      data: {
        organizationId: northline.id,
        companyName,
        trade,
        contactName,
        phone,
        email: `${contactName.split(" ")[0].toLowerCase()}@${slug}.example`,
      },
    });
    subs[trade] = s.id;
  }

  // Work backwards from the late electrical rough-in so the story holds on any date.
  const electricalEnd = wd(-2);
  const electricalStart = addWorkingDays(electricalEnd, -4);
  const framingStart = addWorkingDays(electricalStart, -5);
  const demoStart = addWorkingDays(framingStart, -4);

  const maple = await prisma.project.create({
    data: {
      id: "prj_maple_ridge",
      organizationId: northline.id,
      name: "Maple Ridge Residence Renovation",
      clientName: "The Lindqvist family (fictional)",
      address: "48 Maple Ridge Crescent, Toronto, ON",
      description:
        "Whole-home renovation of a two-storey detached house: second-floor layout change, new primary ensuite, rewiring with a 200A panel upgrade, new HVAC ductwork, and refinished main floor.",
      startDate: demoStart,
      targetEndDate: wd(25),
    },
  });
  for (const trade of Object.keys(subs)) {
    await prisma.projectSubcontractor.create({
      data: { organizationId: northline.id, projectId: maple.id, subcontractorId: subs[trade] },
    });
  }

  type Spec = {
    key: string;
    name: string;
    trade: Trade;
    location?: string;
    start: Date;
    days: number;
    status: TaskStatus;
    pct: number;
    deps: string[];
  };
  const specs: Spec[] = [
    {
      key: "demo",
      name: "Interior demolition & haul-away",
      trade: "DEMOLITION",
      location: "2nd floor",
      start: demoStart,
      days: 4,
      status: "COMPLETE",
      pct: 100,
      deps: [],
    },
    {
      key: "framing",
      name: "Framing modifications",
      trade: "FRAMING",
      location: "2nd floor",
      start: framingStart,
      days: 5,
      status: "COMPLETE",
      pct: 100,
      deps: ["demo"],
    },
    {
      key: "plumbing",
      name: "Plumbing rough-in",
      trade: "PLUMBING",
      location: "2nd floor ensuite",
      start: electricalStart,
      days: 4,
      status: "COMPLETE",
      pct: 100,
      deps: ["framing"],
    },
    {
      key: "hvac",
      name: "HVAC duct rough-in",
      trade: "HVAC",
      location: "2nd floor",
      start: electricalStart,
      days: 3,
      status: "COMPLETE",
      pct: 100,
      deps: ["framing"],
    },
    {
      key: "electrical",
      name: "Electrical rough-in",
      trade: "ELECTRICAL",
      location: "2nd floor",
      start: electricalStart,
      days: 5,
      status: "IN_PROGRESS",
      pct: 60,
      deps: ["framing"],
    },
    {
      key: "inspection",
      name: "Rough-in inspection (city)",
      trade: "GENERAL",
      start: wd(0),
      days: 1,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["plumbing", "hvac", "electrical"],
    },
    {
      key: "insulation",
      name: "Insulation & vapour barrier",
      trade: "INSULATION",
      location: "2nd floor",
      start: wd(1),
      days: 2,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["inspection"],
    },
    {
      key: "drywall",
      name: "Drywall hang, tape & mud",
      trade: "DRYWALL",
      location: "2nd floor",
      start: wd(3),
      days: 6,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["insulation"],
    },
    {
      key: "painting",
      name: "Prime & paint",
      trade: "PAINTING",
      location: "2nd floor",
      start: wd(9),
      days: 4,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["drywall"],
    },
    {
      key: "flooring",
      name: "Engineered hardwood install",
      trade: "FLOORING",
      location: "2nd floor",
      start: wd(13),
      days: 3,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["painting"],
    },
    {
      key: "trim",
      name: "Doors, trim & closet millwork",
      trade: "FINISH_CARPENTRY",
      location: "2nd floor",
      start: wd(16),
      days: 3,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["flooring"],
    },
    {
      key: "walkthrough",
      name: "Final clean & client walkthrough",
      trade: "GENERAL",
      start: wd(19),
      days: 1,
      status: "NOT_STARTED",
      pct: 0,
      deps: ["trim"],
    },
  ];
  const taskIds: Record<string, string> = {};
  for (const s of specs) {
    const t = await prisma.task.create({
      data: {
        organizationId: northline.id,
        projectId: maple.id,
        name: s.name,
        trade: s.trade,
        location: s.location ?? null,
        subcontractorId: subs[s.trade] ?? null,
        status: s.status,
        percentComplete: s.pct,
        plannedStart: s.start,
        durationDays: s.days,
        plannedEnd: plannedEndFor(s.start, s.days),
        completedAt: s.status === "COMPLETE" ? plannedEndFor(s.start, s.days) : null,
      },
    });
    await prisma.taskDependency.createMany({
      data: s.deps.map((d) => ({ organizationId: northline.id, taskId: t.id, dependsOnId: taskIds[d] })),
    });
    taskIds[s.key] = t.id;
  }

  const updates: [string, TaskStatus, number, string, string, number][] = [
    ["plumbing", "IN_PROGRESS", 50, "Supply lines run to ensuite and laundry. Drains next.", sam.id, 96],
    ["hvac", "COMPLETE", 100, "Supply and return runs done for all four bedrooms.", sam.id, 74],
    ["plumbing", "COMPLETE", 100, "Rough-in finished and pressure-tested. Ready for inspection.", sam.id, 50],
    ["electrical", "IN_PROGRESS", 30, "Boxes and home runs in for bedrooms 1 and 2.", sam.id, 70],
    [
      "electrical",
      "IN_PROGRESS",
      60,
      "Bedrooms done. Ensuite and hallway still open. Panel upgrade waiting on the utility disconnect.",
      sam.id,
      20,
    ],
  ];
  for (const [key, status, pct, note, authorId, h] of updates) {
    await prisma.progressUpdate.create({
      data: {
        organizationId: northline.id,
        taskId: taskIds[key],
        status,
        percentComplete: pct,
        note,
        authorId,
        createdAt: hoursAgo(h),
      },
    });
  }

  await prisma.issue.create({
    data: {
      organizationId: northline.id,
      projectId: maple.id,
      taskId: taskIds.electrical,
      title: "Panel upgrade needs a utility disconnect that isn't booked yet",
      details:
        "Brightwire can't finish the 200A panel swap until the utility schedules a disconnect. Earliest slot unknown.",
      severity: "HIGH",
      isBlocker: true,
      createdById: sam.id,
      createdAt: hoursAgo(20),
    },
  });
  await prisma.issue.create({
    data: {
      organizationId: northline.id,
      projectId: maple.id,
      title: "Client hasn't confirmed ensuite tile selection",
      details: "Needed before tile is ordered. Lead time is about 2 weeks.",
      severity: "MEDIUM",
      createdById: dana.id,
      createdAt: hoursAgo(44),
    },
  });

  await prisma.followUp.create({
    data: {
      organizationId: northline.id,
      projectId: maple.id,
      taskId: taskIds.plumbing,
      subcontractorId: subs.PLUMBING,
      message:
        "Thanks for wrapping up the second-floor rough-in. Could you send the pressure test photos for our records?",
      status: "APPROVED",
      createdById: sam.id,
      reviewedById: dana.id,
      reviewedAt: hoursAgo(46),
      createdAt: hoursAgo(49),
    },
  });
  await prisma.followUp.create({
    data: {
      organizationId: northline.id,
      projectId: maple.id,
      taskId: taskIds.electrical,
      subcontractorId: subs.ELECTRICAL,
      message:
        "Hi Priya, can you confirm when the second-floor rough-in will be finished? We need a firm date to book the city inspection before drywall.",
      dueDate: wd(0),
      createdById: sam.id,
      createdAt: hoursAgo(6),
    },
  });
  await prisma.followUp.create({
    data: {
      organizationId: northline.id,
      projectId: maple.id,
      taskId: taskIds.drywall,
      subcontractorId: subs.DRYWALL,
      message:
        "Heads up: drywall on the second floor may slip a day or two while we wait on the electrical rough-in and inspection. We'll confirm the start date by end of day tomorrow.",
      createdById: sam.id,
      createdAt: hoursAgo(5),
    },
  });

  const activity: [string, string, string, string, string, number][] = [
    [dana.id, "project.created", "project", maple.id, `Created project "${maple.name}"`, 400],
    [sam.id, "task.progress_recorded", "progress", taskIds.plumbing, `"Plumbing rough-in": complete, 100%`, 50],
    [
      dana.id,
      "follow_up.approved",
      "follow_up",
      taskIds.plumbing,
      "Approved follow-up to Bluewater Plumbing about pressure test photos",
      46,
    ],
    [
      sam.id,
      "issue.opened",
      "issue",
      taskIds.electrical,
      "Opened blocking issue: Panel upgrade needs a utility disconnect that isn't booked yet",
      20,
    ],
    [sam.id, "task.progress_recorded", "progress", taskIds.electrical, `"Electrical rough-in": in progress, 60%`, 20],
    [
      sam.id,
      "follow_up.drafted",
      "follow_up",
      taskIds.electrical,
      "Drafted follow-up for approval: ask Brightwire Electric for a firm finish date",
      6,
    ],
    [
      sam.id,
      "follow_up.drafted",
      "follow_up",
      taskIds.drywall,
      "Drafted follow-up for approval: warn Trueline Drywall about a possible slip",
      5,
    ],
  ];
  for (const [actorId, action, entityType, entityId, summary, h] of activity) {
    await prisma.activityLog.create({
      data: {
        organizationId: northline.id,
        projectId: maple.id,
        actorId,
        action,
        entityType,
        entityId,
        summary,
        createdAt: hoursAgo(h),
      },
    });
  }

  // A second, early-stage Northline project.
  const elm = await prisma.project.create({
    data: {
      id: "prj_elm_duplex",
      organizationId: northline.id,
      name: "Elm Street Duplex Basement Suite",
      address: "112 Elm Street, Hamilton, ON",
      description:
        "Legal secondary suite in an existing basement: egress window, separate HVAC zone, and fire separation.",
      startDate: wd(-3),
      targetEndDate: wd(40),
    },
  });
  const elmDemo = await prisma.task.create({
    data: {
      organizationId: northline.id,
      projectId: elm.id,
      name: "Basement demolition",
      trade: "DEMOLITION",
      subcontractorId: subs.DEMOLITION,
      status: "IN_PROGRESS",
      percentComplete: 70,
      plannedStart: wd(-3),
      durationDays: 5,
      plannedEnd: plannedEndFor(wd(-3), 5),
    },
  });
  const egress = await prisma.task.create({
    data: {
      organizationId: northline.id,
      projectId: elm.id,
      name: "Egress window cut & install",
      trade: "CONCRETE",
      plannedStart: wd(2),
      durationDays: 3,
      plannedEnd: plannedEndFor(wd(2), 3),
    },
  });
  await prisma.taskDependency.create({
    data: { organizationId: northline.id, taskId: egress.id, dependsOnId: elmDemo.id },
  });
  await prisma.activityLog.create({
    data: {
      organizationId: northline.id,
      projectId: elm.id,
      actorId: dana.id,
      action: "project.created",
      entityType: "project",
      entityId: elm.id,
      summary: `Created project "${elm.name}"`,
      createdAt: hoursAgo(90),
    },
  });

  // ---------------- Granite Peak (second tenant, used to demo isolation) ----------------
  const granite = await prisma.organization.create({ data: { name: "Granite Peak Contracting (fictional)" } });
  await prisma.user.create({
    data: {
      organizationId: granite.id,
      name: "Lee Park",
      email: "lee@granitepeak.example",
      role: "OWNER",
      passwordHash,
    },
  });
  const harbour = await prisma.project.create({
    data: {
      id: "prj_harbourview",
      organizationId: granite.id,
      name: "Harbourview Condo Kitchen Refit",
      address: "Unit 1804, 9 Harbourview Lane, Toronto, ON",
      startDate: wd(-5),
    },
  });
  await prisma.task.create({
    data: {
      organizationId: granite.id,
      projectId: harbour.id,
      name: "Cabinet removal",
      trade: "DEMOLITION",
      status: "COMPLETE",
      percentComplete: 100,
      plannedStart: wd(-5),
      durationDays: 2,
      plannedEnd: plannedEndFor(wd(-5), 2),
    },
  });

  console.log("Seeded fictional demo data.");
  console.log("  Owner:   dana@northline.example");
  console.log("  Member:  sam@northline.example");
  console.log("  Other company (isolation demo): lee@granitepeak.example");
  console.log("  Password: the SEED_DEMO_PASSWORD value from your .env");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
