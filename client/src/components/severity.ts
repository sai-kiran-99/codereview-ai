import type { Severity } from "../types";

export const SEVERITY_STYLES: Record<Severity, { badge: string; line: string; dot: string }> = {
  critical: { badge: "bg-red-100 text-red-800 ring-red-200", line: "bg-red-50", dot: "bg-red-500" },
  major: { badge: "bg-orange-100 text-orange-800 ring-orange-200", line: "bg-orange-50", dot: "bg-orange-500" },
  minor: { badge: "bg-amber-100 text-amber-800 ring-amber-200", line: "bg-amber-50", dot: "bg-amber-400" },
  info: { badge: "bg-sky-100 text-sky-800 ring-sky-200", line: "bg-sky-50", dot: "bg-sky-400" },
};
