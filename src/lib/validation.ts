import { z } from "zod";
import { TASK_STATUSES, TRADES } from "./domain/trades";
import { parseISODate } from "./domain/calendar";

/** Treat empty form fields as "not provided". */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} character${min === 1 ? "" : "s"}`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `Must be at most ${max} characters`).optional());

const isoDate = z.string({ error: "Date is required" }).superRefine((value, ctx) => {
  // One clear message per problem (an empty field shouldn't also be "not a real date").
  if (value.trim() === "") ctx.addIssue({ code: "custom", message: "Date is required" });
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) ctx.addIssue({ code: "custom", message: "Use the format YYYY-MM-DD" });
  else {
    try {
      parseISODate(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Not a real calendar date" });
    }
  }
});

const optionalIsoDate = z.preprocess(blankToUndefined, isoDate.optional());
const optionalId = z.preprocess(blankToUndefined, z.string().trim().max(64).optional());
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email("Enter a valid email address").max(254),
);

export const signUpSchema = z.object({
  organizationName: requiredText("Company name", 2, 100),
  name: requiredText("Your name", 1, 100),
  email: emailSchema,
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(200, "Password must be at most 200 characters"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(200),
});

export const projectSchema = z
  .object({
    name: requiredText("Project name", 2, 120),
    clientName: optionalText(120),
    address: requiredText("Address", 3, 200),
    description: optionalText(2000),
    startDate: isoDate,
    targetEndDate: optionalIsoDate,
  })
  .refine((p) => !p.targetEndDate || p.targetEndDate >= p.startDate, {
    message: "Target end date must be on or after the start date",
    path: ["targetEndDate"],
  });

export const subcontractorSchema = z.object({
  companyName: requiredText("Company name", 2, 120),
  trade: z.enum(TRADES, { error: "Choose a trade" }),
  contactName: requiredText("Contact name", 1, 100),
  email: z.preprocess(blankToUndefined, z.email("Enter a valid email address").max(254).optional()),
  phone: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .regex(/^[0-9+().\-\s]{7,25}$/, "Enter a valid phone number")
      .optional(),
  ),
});

export const taskSchema = z.object({
  name: requiredText("Task name", 2, 120),
  trade: z.enum(TRADES, { error: "Choose a trade" }),
  location: optionalText(120),
  subcontractorId: optionalId,
  plannedStart: isoDate,
  durationDays: z.coerce
    .number({ error: "Duration is required" })
    .int("Duration must be a whole number of working days")
    .min(1, "Duration must be at least 1 working day")
    .max(365, "Duration must be at most 365 working days"),
  dependsOn: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
});

export const progressSchema = z
  .object({
    status: z.enum(TASK_STATUSES, { error: "Choose a status" }),
    percentComplete: z.coerce
      .number({ error: "Percent complete is required" })
      .int()
      .min(0, "Must be between 0 and 100")
      .max(100, "Must be between 0 and 100"),
    note: requiredText("Note", 1, 2000),
  })
  // A task marked complete is 100% complete, whatever the slider said.
  .transform((p) => (p.status === "COMPLETE" ? { ...p, percentComplete: 100 } : p));

export const issueSchema = z.object({
  title: requiredText("Title", 3, 160),
  details: optionalText(2000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"], { error: "Choose a severity" }),
  isBlocker: checkbox,
  taskId: optionalId,
});

export const followUpSchema = z.object({
  message: requiredText("Message", 5, 1000),
  taskId: optionalId,
  subcontractorId: optionalId,
  dueDate: optionalIsoDate,
});

export const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: optionalText(500),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type SubcontractorInput = z.infer<typeof subcontractorSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type IssueInput = z.infer<typeof issueSchema>;
export type FollowUpInput = z.infer<typeof followUpSchema>;

/** Converts FormData into a plain object. Keys listed in `arrays` keep every value. */
export function formDataToObject(formData: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue; // Next.js internal fields
    out[key] = arrays.includes(key) ? formData.getAll(key).map(String) : formData.get(key);
  }
  for (const key of arrays) if (!(key in out)) out[key] = [];
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
