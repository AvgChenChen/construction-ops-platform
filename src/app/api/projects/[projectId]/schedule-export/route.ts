import { NextResponse } from "next/server";
import { todayInTimeZone } from "@/lib/domain/calendar";
import { getCurrentSession } from "@/server/auth/current";
import { AppError } from "@/server/services/errors";
import { exportSchedule } from "@/server/services/schedule-export";

export const dynamic = "force-dynamic";

/** GET the project's schedule in the shared ScheduleContract v1 format (see docs/INTEGRATION.md). */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = { userId: session.user.id, orgId: session.user.organizationId, role: session.user.role };
  const { projectId } = await params;
  try {
    const today = todayInTimeZone(process.env.APP_TIMEZONE ?? "America/Toronto");
    return NextResponse.json(await exportSchedule(ctx, projectId, today));
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    throw error;
  }
}
