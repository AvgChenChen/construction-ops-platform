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

  // Edge cases, predicted from reading the code before running (OPS-004).
  it("returns the date unchanged when adding zero working days, even on a weekend", () => {
    // plannedEndFor normalises the start first, so this only matters for direct callers.
    expect(toISODate(addWorkingDays(d("2026-11-07"), 0))).toBe("2026-11-07"); // Saturday stays Saturday
    expect(toISODate(addWorkingDays(d("2026-11-07"), 1))).toBe("2026-11-09"); // Sat + 1 -> Mon
    expect(toISODate(addWorkingDays(d("2026-11-08"), -1))).toBe("2026-11-06"); // Sun - 1 -> Fri
  });

  it("finishes 1- and 2-day tasks that start on a Friday or a weekend correctly", () => {
    expect(toISODate(plannedEndFor(d("2026-11-06"), 1))).toBe("2026-11-06"); // Fri, same day
    expect(toISODate(plannedEndFor(d("2026-11-06"), 2))).toBe("2026-11-09"); // Fri, Mon
    expect(toISODate(plannedEndFor(d("2026-11-08"), 1))).toBe("2026-11-09"); // starts Sunday -> Monday
    expect(() => plannedEndFor(d("2026-11-02"), 1.5)).toThrow();
  });

  it("counts backwards when `from` is after `to`, mirroring the forward count between working days", () => {
    expect(workingDaysBetween(d("2026-11-13"), d("2026-11-02"))).toBe(-9);
    expect(workingDaysBetween(d("2026-11-02"), d("2026-11-13"))).toBe(9);
  });

  it("includes `to` and excludes `from`, so a weekend endpoint breaks the mirror", () => {
    // Fri -> Sat adds no working day, but Sat -> Fri passes one (Friday itself).
    // blockers.ts relies on this: a task planned for Friday not started by Saturday is 1 day late.
    expect(workingDaysBetween(d("2026-11-06"), d("2026-11-07"))).toBe(0);
    expect(workingDaysBetween(d("2026-11-07"), d("2026-11-06"))).toBe(-1);
  });

  it("crosses a month and year end (holidays are not modelled)", () => {
    // Wed Dec 30, Thu Dec 31, Fri Jan 1 (a holiday in reality, but this calendar is Mon-Fri only)
    expect(toISODate(plannedEndFor(d("2026-12-30"), 3))).toBe("2027-01-01");
    expect(workingDaysBetween(d("2026-12-31"), d("2027-01-04"))).toBe(2); // Fri Jan 1, Mon Jan 4
  });

  it("decides 'today' in the configured time zone, not UTC", () => {
    // 02:30 UTC on Nov 3 is still the evening of Nov 2 in Toronto.
    const instant = new Date("2026-11-03T02:30:00Z");
    expect(toISODate(todayInTimeZone("America/Toronto", instant))).toBe("2026-11-02");
    expect(toISODate(todayInTimeZone("UTC", instant))).toBe("2026-11-03");
  });
});
