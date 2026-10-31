import { todayInTimeZone } from "./domain/calendar";

export function appToday(): Date {
  return todayInTimeZone(process.env.APP_TIMEZONE ?? "America/Toronto");
}
