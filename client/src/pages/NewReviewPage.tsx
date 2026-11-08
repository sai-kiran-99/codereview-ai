import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CodeEditor } from "../components/CodeEditor";
import { IssueCard } from "../components/IssueCard";
import { IssueCounts } from "../components/SeverityBadge";
import { buttonClass, EmptyState, ErrorBanner, inputClass, secondaryButtonClass, Spinner } from "../components/ui";
import { useStreamingReview } from "../hooks/useStreamingReview";
import { LANGUAGES, SEVERITIES, type Language, type Severity } from "../types";

const MAX_BYTES = 20_000;
const SAMPLE = `function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  const users = db.query(query);
  for (var i = 0; i <= users.length; i++) {
    if (users[i].id == id) return users[i];
  }
}`;

export function NewReviewPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("javascript");
  const [title, setTitle] = useState("");
  const review = useStreamingReview({
    onFinish: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });

  const bytes = new TextEncoder().encode(code).length;
  const tooBig = bytes > MAX_BYTES;
  const streaming = review.status === "streaming";
  const canSubmit = code.trim().length > 0 && !tooBig && !streaming;

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const issue of review.issues) counts[issue.severity]++;

  const submit = () => review.start({ code, language, title: title.trim() || undefined });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">New review</h1>
          {!code && (
            <button onClick={() => setCode(SAMPLE)} className="text-sm text-indigo-600 hover:underline">
              Try a sample
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input aria-label="Title (optional)" placeholder="Title (optional)" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={`${inputClass} sm:w-44`}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="h-[55vh] min-h-[320px]">
          <CodeEditor value={code} onChange={setCode} disabled={streaming} />
        </div>
        <div className="flex items-center gap-3">
          {streaming ? (
            <button onClick={review.cancel} className={secondaryButtonClass}>Stop</button>
          ) : (
            <button onClick={submit} disabled={!canSubmit} className={buttonClass}>Review code</button>
          )}
          <span className={`ml-auto text-xs ${tooBig ? "font-medium text-red-600" : "text-slate-500"}`}>
            {(bytes / 1000).toFixed(1)} / {MAX_BYTES / 1000} KB
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        {review.status === "idle" && (
          <EmptyState title="Your review will appear here">
            Paste some code, pick a language and press <b>Review code</b>. The summary shows first, then each issue as it's found.
          </EmptyState>
        )}

        {review.status !== "idle" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              {streaming && <Spinner className="h-4 w-4" />}
              <h2 className="font-semibold">{review.title ?? (streaming ? "Reviewing…" : "Review")}</h2>
              {review.status === "done" && review.latencyMs != null && (
                <span className="ml-auto text-xs text-slate-500">{(review.latencyMs / 1000).toFixed(1)}s</span>
              )}
            </div>
            {review.summary ? (
              <p className="mt-2 text-sm text-slate-700">{review.summary}</p>
            ) : (
              streaming && (
                <div className="mt-3 space-y-2" aria-hidden="true">
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                </div>
              )
            )}
            {(review.issues.length > 0 || review.status === "done") && (
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                <IssueCounts counts={counts} />
                {review.status === "done" && review.reviewId && (
                  <Link to={`/reviews/${review.reviewId}`} className="ml-auto text-sm font-medium text-indigo-600 hover:underline">
                    Open full review →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {review.status === "error" && <ErrorBanner message={review.error ?? "Review failed"} onRetry={canSubmit ? submit : undefined} />}
        {review.status === "cancelled" && <ErrorBanner message="Review stopped." onRetry={canSubmit ? submit : undefined} />}

        {review.issues.map((issue, i) => (
          <IssueCard key={`${issue.line}-${i}`} issue={issue} />
        ))}

        {review.status === "done" && review.issues.length === 0 && (
          <EmptyState title="No issues found">Nice — the reviewer didn't find anything to fix.</EmptyState>
        )}
      </section>
    </div>
  );
}
