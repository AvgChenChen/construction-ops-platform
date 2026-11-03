import type { FollowUpStatus, IssueSeverity, TaskStatus } from "@prisma/client";
import { FOLLOW_UP_STATUS_LABELS, STATUS_LABELS } from "@/lib/domain/trades";
import { Badge, type BadgeTone } from "./primitives";

// Each table must have an entry for every value of its Prisma enum. `satisfies` makes the
// compiler check that (a missing or misspelt key is an error) while keeping the exact literal
// types of the values, which a plain `: Record<…>` annotation would widen.
const STATUS_TONE = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  COMPLETE: "success",
} as const satisfies Record<TaskStatus, BadgeTone>;

const SEVERITY_TONE = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
} as const satisfies Record<IssueSeverity, BadgeTone>;

const FOLLOW_UP_TONE = {
  PENDING_APPROVAL: "primary",
  APPROVED: "success",
  REJECTED: "neutral",
} as const satisfies Record<FollowUpStatus, BadgeTone>;

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function RiskBadge({ level }: { level: "blocked" | "at_risk" }) {
  return level === "blocked" ? <Badge tone="danger">Blocked</Badge> : <Badge tone="warning">At risk</Badge>;
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity.charAt(0) + severity.slice(1).toLowerCase()} severity</Badge>;
}

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  return <Badge tone={FOLLOW_UP_TONE[status]}>{FOLLOW_UP_STATUS_LABELS[status]}</Badge>;
}
