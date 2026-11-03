/**
 * Working-day calendar helpers.
 *
 * Assumptions (kept deliberately simple and documented in the README):
 * - Work happens Monday to Friday. Statutory holidays are not modelled here.
 * - Dates are calendar dates with no time component. They are stored as UTC midnight
 *   (Postgres `date`) and always formatted in UTC so they never shift by a day.
 * - A task with duration N starts at the beginning of its start day and finishes at the
 *   end of its Nth working day, so a 1-day task starts and ends on the same date.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseISODate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}`);
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

/** Returns the date itself if it is a working day, otherwise the next working day. */
export function nextWorkingDayOnOrAfter(date: Date): Date {
  let d = new Date(date.getTime());
  while (!isWorkingDay(d)) d = new Date(d.getTime() + DAY_MS);
  return d;
}

/**
 * Moves forward (n > 0) or backward (n < 0) by n working days.
 * With n = 0 the date is returned unchanged, even if it's a weekend; use
 * nextWorkingDayOnOrAfter first when the start must be a working day (plannedEndFor does).
 */
export function addWorkingDays(date: Date, n: number): Date {
  let d = new Date(date.getTime());
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d = new Date(d.getTime() + step * DAY_MS);
    if (isWorkingDay(d)) remaining -= 1;
  }
  return d;
}

/** Finish date of a task that starts on `start` and lasts `durationDays` working days. */
export function plannedEndFor(start: Date, durationDays: number): Date {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error("durationDays must be a positive integer");
  }
  return addWorkingDays(nextWorkingDayOnOrAfter(start), durationDays - 1);
}

/**
 * Number of working days after `from` up to and including `to`.
 * Negative when `to` is before `from`. Zero when they are the same day.
 *
 * `to` is counted and `from` isn't, in both directions, so the result is only the mirror
 * image of the reverse call when both ends are working days: Fri -> Sat is 0, but
 * Sat -> Fri is -1. blockers.ts relies on this (a task planned for Friday that hasn't
 * started by Saturday is one working day late).
 */
export function workingDaysBetween(from: Date, to: Date): number {
  if (to.getTime() === from.getTime()) return 0;
  const forward = to.getTime() > from.getTime();
  let count = 0;
  let d = new Date(from.getTime());
  while (d.getTime() !== to.getTime()) {
    d = new Date(d.getTime() + (forward ? DAY_MS : -DAY_MS));
    if (isWorkingDay(d)) count += 1;
  }
  return forward ? count : -count;
}

/** Today's calendar date in the given IANA time zone, as a UTC-midnight Date. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseISODate(iso);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
