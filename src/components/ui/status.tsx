import type { TaskStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/domain/trades";
import { Badge, type BadgeTone } from "./primitives";

const STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  COMPLETE: "success",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function RiskBadge({ level }: { level: "blocked" | "at_risk" }) {
  return level === "blocked" ? <Badge tone="danger">Blocked</Badge> : <Badge tone="warning">At risk</Badge>;
}

export function SeverityBadge({ severity }: { severity: "LOW" | "MEDIUM" | "HIGH" }) {
  const tone: Record<typeof severity, BadgeTone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger" };
  return <Badge tone={tone[severity]}>{severity.charAt(0) + severity.slice(1).toLowerCase()} severity</Badge>;
}
