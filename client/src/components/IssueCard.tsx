import type { Issue } from "../types";
import { SeverityBadge } from "./SeverityBadge";

export function IssueCard({ issue, onSelectLine }: { issue: Issue; onSelectLine?: (line: number) => void }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{issue.category}</span>
        {onSelectLine ? (
          <button
            onClick={() => onSelectLine(issue.line)}
            className="ml-auto font-mono text-xs text-indigo-600 hover:underline"
          >
            Line {issue.line}
          </button>
        ) : (
          <span className="ml-auto font-mono text-xs text-slate-500">Line {issue.line}</span>
        )}
      </header>
      <p className="mt-2 text-sm text-slate-800">{issue.message}</p>
      {issue.suggestion && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Suggested fix</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
            {issue.suggestion}
          </pre>
        </div>
      )}
    </article>
  );
}
