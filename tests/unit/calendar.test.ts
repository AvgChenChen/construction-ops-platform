import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  nextWorkingDayOnOrAfter,
  parseISODate,
  plannedEndFor,
  toISODate,
  todayInTimeZone,
  workingDaysBetween,
} from "@/lib/domain/calendar";

const d = parseISODate;

describe("working-day calendar", () => {
  it("parses and rejects dates strictly", () => {
    expect(toISODate(d("2026-11-02"))).toBe("2026-11-02");
    expect(() => d("2026-02-30")).toThrow();
    expect(() => d("02/11/2026")).toThrow();
  });

  it("counts a 1-day task as starting and ending on the same day", () => {
    expect(toISODate(plannedEndFor(d("2026-11-02"), 1))).toBe("2026-11-02");
  });

  it("skips weekends when computing finish dates", () => {
    // Thu, Fri, (weekend), Mon
    expect(toISODate(plannedEndFor(d("2026-11-05"), 3))).toBe("2026-11-09");
    // A task "starting" on Saturday really starts Monday
    expect(toISODate(plannedEndFor(d("2026-10-31"), 1))).toBe("2026-11-02");
    expect(() => plannedEndFor(d("2026-11-02"), 0)).toThrow();
  });

  it("moves forward and backward by working days", () => {
    expect(toISODate(addWorkingDays(d("2026-11-06"), 1))).toBe("2026-11-09");
    expect(toISODate(addWorkingDays(d("2026-11-09"), -1))).toBe("2026-11-06");
    expect(toISODate(addWorkingDays(d("2026-11-04"), 0))).toBe("2026-11-04");
    expect(toISODate(nextWorkingDayOnOrAfter(d("2026-11-01")))).toBe("2026-11-02");
  });

  it("counts working days between dates (signed)", () => {
    expect(workingDaysBetween(d("2026-11-02"), d("2026-11-02"))).toBe(0);
    expect(workingDaysBetween(d("2026-11-06"), d("2026-11-09"))).toBe(1);
    expect(workingDaysBetween(d("2026-11-09"), d("2026-11-06"))).toBe(-1);
    expect(workingDaysBetween(d("2026-10-31"), d("2026-11-02"))).toBe(1); // Sat -> Mon
  });

  it("decides 'today' in the configured time zone, not UTC", () => {
    // 02:30 UTC on Nov 3 is still the evening of Nov 2 in Toronto.
    const instant = new Date("2026-11-03T02:30:00Z");
    expect(toISODate(todayInTimeZone("America/Toronto", instant))).toBe("2026-11-02");
    expect(toISODate(todayInTimeZone("UTC", instant))).toBe("2026-11-03");
  });
});
