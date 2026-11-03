import type { FollowUpStatus, Role, Trade, TaskStatus } from "@prisma/client";

export const TRADES = [
  "GENERAL",
  "DEMOLITION",
  "CONCRETE",
  "FRAMING",
  "ROOFING",
  "PLUMBING",
  "ELECTRICAL",
  "HVAC",
  "INSULATION",
  "DRYWALL",
  "PAINTING",
  "FLOORING",
  "FINISH_CARPENTRY",
  "OTHER",
] as const satisfies readonly Trade[];

export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETE",
] as const satisfies readonly TaskStatus[];

export const TRADE_LABELS: Record<Trade, string> = {
  GENERAL: "General",
  DEMOLITION: "Demolition",
  CONCRETE: "Concrete",
  FRAMING: "Framing",
  ROOFING: "Roofing",
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  HVAC: "HVAC",
  INSULATION: "Insulation",
  DRYWALL: "Drywall",
  PAINTING: "Painting",
  FLOORING: "Flooring",
  FINISH_CARPENTRY: "Finish carpentry",
  OTHER: "Other",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETE: "Complete",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MEMBER: "Member",
};

/** Shared-contract spelling used by field-update-ai-agent and construction-dependency-engine. */
export function toContractEnum(value: string): string {
  return value.toLowerCase();
}
