import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { deleteReview, getReview } from "../api/reviews";
import { CodeView } from "../components/CodeView";
import { IssueCard } from "../components/IssueCard";
import { IssueCounts } from "../components/SeverityBadge";
import { EmptyState, ErrorBanner, FullPageSpinner, secondaryButtonClass } from "../components/ui";
import { SEVERITIES, type Severity } from "../types";

export function ReviewDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const codeRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: review, isPending, isError, error, refetch } = useQuery({
    queryKey: ["reviews", "detail", id],
    queryFn: () => getReview(id),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const remove = useMutation({
    mutationFn: () => deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      navigate("/history");
    },
  });

  function selectLine(line: number) {
    setActiveLine(line);
    codeRef.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (isPending) return <FullPageSpinner />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState title="Review not found">
          <Link to="/history" className="font-medium text-indigo-600 hover:underline">Back to history</Link>
        </EmptyState>
      );
    }
    return <ErrorBanner message={error.message} onRetry={() => refetch()} />;
  }

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const issue of review.issues) counts[issue.severity]++;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <Link to="/history" className="text-sm text-slate-500 hover:text-slate-700">← History</Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{review.title}</h1>
          <p className="text-xs text-slate-500">
            {review.language} · {new Date(review.createdAt).toLocaleString()}
            {review.latencyMs != null && ` · ${(review.latencyMs / 1000).toFixed(1)}s`}
            {review.model && ` · ${review.model}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-slate-600">Delete this review?</span>
              <button onClick={() => remove.mutate()} disabled={remove.isPending} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                Delete
              </button>
              <button onClick={() => setConfirming(false)} className={secondaryButtonClass}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className={secondaryButtonClass}>Delete</button>
          )}
        </div>
      </div>

      {remove.isError && <ErrorBanner message={remove.error.message} />}
      {review.status === "failed" && <ErrorBanner message={`This review failed: ${review.error ?? "unknown error"}.`} />}
      {review.status === "running" && <ErrorBanner message="This review is still running. Refresh in a few seconds." onRetry={() => refetch()} />}

      {review.summary && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">{review.summary}</p>
          <div className="mt-3 border-t border-slate-100 pt-3"><IssueCounts counts={counts} /></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CodeView ref={codeRef} code={review.code} issues={review.issues} activeLine={activeLine} />
        <div className="space-y-3">
          {review.issues.length === 0 && review.status === "done" ? (
            <EmptyState title="No issues found" />
          ) : (
            review.issues.map((issue, i) => <IssueCard key={`${issue.line}-${i}`} issue={issue} onSelectLine={selectLine} />)
          )}
        </div>
      </div>
    </div>
  );
}
