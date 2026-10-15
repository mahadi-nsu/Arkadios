import rawSeed from "@/data/seed.json";
import { Dataset } from "./model";
import { dayDiff, localDate, shiftDate } from "./dates";
import { evaluateRules } from "./engine";
import { validateDataset } from "./validation";
export function createSeed(today = localDate()): Dataset {
  const offset = dayDiff(today, rawSeed.settings.anchorDate);
  const shift = (value: unknown): unknown => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value))
      return shiftDate(value.slice(0, 10), offset) + value.slice(10);
    if (Array.isArray(value)) return value.map(shift);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, shift(v)]),
      );
    return value;
  };
  const d = validateDataset(shift(rawSeed));
  evaluateRules(d);
  return d;
}
