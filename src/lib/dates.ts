import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
export const localDate = (d = new Date()) => format(d, "yyyy-MM-dd");
export const shiftDate = (date: string, days: number) =>
  format(addDays(parseISO(date), days), "yyyy-MM-dd");
export const dayDiff = (later: string, earlier: string) =>
  differenceInCalendarDays(parseISO(later), parseISO(earlier));
export const prettyDate = (date: string, pattern = "MMM d, yyyy") =>
  date ? format(parseISO(date), pattern) : "—";
export const eventTime = (demoDate: string) =>
  `${demoDate}T${new Date().toISOString().slice(11)}`;
