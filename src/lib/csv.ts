import Papa from "papaparse";
import { download } from "./utils";
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  download(
    name,
    Papa.unparse(rows, { escapeFormulae: true }),
    "text/csv;charset=utf-8",
  );
}
export function parseCSV(raw: string) {
  if (raw.length > 5 * 1024 * 1024) throw new Error("CSV exceeds 5 MB.");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  if (parsed.data.length > 2000) throw new Error("Import at most 2,000 rows.");
  if (!parsed.meta.fields?.length)
    throw new Error("The CSV needs a header row.");
  return { rows: parsed.data, fields: parsed.meta.fields };
}
