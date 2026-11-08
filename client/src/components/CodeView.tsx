import { forwardRef } from "react";
import type { Issue, Severity } from "../types";
import { SEVERITY_STYLES } from "./severity";

const RANK: Record<Severity, number> = { critical: 0, major: 1, minor: 2, info: 3 };

/** Read-only code with each line tinted by its most severe issue. */
export const CodeView = forwardRef<HTMLDivElement, { code: string; issues: Issue[]; activeLine?: number | null }>(
  function CodeView({ code, issues, activeLine }, ref) {
    const worst = new Map<number, Severity>();
    for (const issue of issues) {
      const current = worst.get(issue.line);
      if (!current || RANK[issue.severity] < RANK[current]) worst.set(issue.line, issue.severity);
    }

    return (
      <div ref={ref} className="overflow-auto rounded-xl border border-slate-200 bg-white font-mono text-[13px] leading-6 shadow-sm">
        {code.split("\n").map((text, i) => {
          const line = i + 1;
          const sev = worst.get(line);
          return (
            <div
              key={line}
              data-line={line}
              className={`flex ${sev ? SEVERITY_STYLES[sev].line : ""} ${activeLine === line ? "outline-2 -outline-offset-2 outline-indigo-500" : ""}`}
            >
              <span className="w-12 shrink-0 select-none border-r border-slate-100 pr-3 text-right text-slate-400">{line}</span>
              <span className="w-4 shrink-0">{sev && <span className={`ml-1 mt-2.5 block h-1.5 w-1.5 rounded-full ${SEVERITY_STYLES[sev].dot}`} />}</span>
              <pre className="whitespace-pre-wrap break-all pr-4 text-slate-800">{text || " "}</pre>
            </div>
          );
        })}
      </div>
    );
  },
);
