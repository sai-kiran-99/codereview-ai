import type { Severity } from "../types";
import { SEVERITY_STYLES } from "./severity";


export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${SEVERITY_STYLES[severity].badge}`}>
      {severity}
    </span>
  );
}

export function IssueCounts({ counts }: { counts: Record<Severity, number> }) {
  const entries = (Object.keys(SEVERITY_STYLES) as Severity[]).filter((s) => counts[s] > 0);
  if (entries.length === 0) return <span className="text-xs text-slate-500">No issues</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 text-xs text-slate-600">
          <span className={`h-2 w-2 rounded-full ${SEVERITY_STYLES[s].dot}`} />
          {counts[s]} {s}
        </span>
      ))}
    </div>
  );
}
