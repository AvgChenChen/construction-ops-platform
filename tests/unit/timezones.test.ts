import { describe, expect, it } from "vitest";
import { parseISODate, plannedEndFor, todayInTimeZone, toISODate, workingDaysBetween } from "@/lib/domain/calendar";

/**
 * Toronto (America/Toronto) and Vancouver (America/Vancouver) around the 2026 DST changes.
 * 2026: clocks spring forward Sun Mar 8 and fall back Sun Nov 1 in both zones.
 */
const iso = (tz: string, instant: string) => toISODate(todayInTimeZone(tz, new Date(instant)));

describe("project 'today' in Toronto vs Vancouver", () => {
  it("differs late in the Vancouver evening (Toronto is already tomorrow)", () => {
    // 2026-11-07 06:30Z = Sat 01:30 EST in Toronto, Fri 22:30 PST in Vancouver
    expect(iso("America/Toronto", "2026-11-07T06:30:00Z")).toBe("2026-11-07");
    expect(iso("America/Vancouver", "2026-11-07T06:30:00Z")).toBe("2026-11-06");
  });

  it("handles the spring-forward boundary (Mar 8 2026)", () => {
    // 07:30Z = 03:30 EDT Toronto (after the jump), 23:30 PST Mar 7 Vancouver
    expect(iso("America/Toronto", "2026-03-08T07:30:00Z")).toBe("2026-03-08");
    expect(iso("America/Vancouver", "2026-03-08T07:30:00Z")).toBe("2026-03-07");
    // 07:59Z is still Mar 7 in Vancouver; 08:00Z is midnight PST Mar 8
    expect(iso("America/Vancouver", "2026-03-08T07:59:59Z")).toBe("2026-03-07");
    expect(iso("America/Vancouver", "2026-03-08T08:00:00Z")).toBe("2026-03-08");
  });

  it("handles the fall-back boundary (Nov 1 2026), including the repeated hour", () => {
    // 05:30Z = 01:30 EDT (first 1:30) and 06:30Z = 01:30 EST (repeated) in Toronto: same date
    expect(iso("America/Toronto", "2026-11-01T05:30:00Z")).toBe("2026-11-01");
    expect(iso("America/Toronto", "2026-11-01T06:30:00Z")).toBe("2026-11-01");
    // Vancouver midnight: 07:00Z is 00:00 PDT Nov 1; 06:59Z is still Oct 31
    expect(iso("America/Vancouver", "2026-11-01T06:59:59Z")).toBe("2026-10-31");
    expect(iso("America/Vancouver", "2026-11-01T07:00:00Z")).toBe("2026-11-01");
  });
});

describe("date-only schedule values stay date-only across DST weekends", () => {
  it("a task spanning the fall-back weekend ends on the right working day", () => {
    // Thu Oct 29 + 4 working days -> Tue Nov 3
    expect(toISODate(plannedEndFor(parseISODate("2026-10-29"), 4))).toBe("2026-11-03");
  });

  it("a task spanning the spring-forward weekend ends on the right working day", () => {
    // Fri Mar 6 + 3 working days -> Tue Mar 10
    expect(toISODate(plannedEndFor(parseISODate("2026-03-06"), 3))).toBe("2026-03-10");
    expect(workingDaysBetween(parseISODate("2026-03-06"), parseISODate("2026-03-10"))).toBe(2);
  });

  it("stores dates as UTC midnight with no time-of-day drift", () => {
    for (const day of ["2026-03-08", "2026-11-01", "2026-12-31"]) {
      const date = parseISODate(day);
      expect(date.getUTCHours() + date.getUTCMinutes() + date.getUTCSeconds()).toBe(0);
      expect(toISODate(date)).toBe(day);
    }
  });
});
