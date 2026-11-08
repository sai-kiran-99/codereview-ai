import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listReviews } from "../api/reviews";
import { IssueCounts } from "../components/SeverityBadge";
import { EmptyState, ErrorBanner, inputClass, secondaryButtonClass, Spinner } from "../components/ui";
import { LANGUAGES, type ReviewStatus } from "../types";

const languageLabel = (v: string) => LANGUAGES.find((l) => l.value === v)?.label ?? v;

const STATUS_STYLE: Record<ReviewStatus, string> = {
  done: "bg-emerald-50 text-emerald-700",
  running: "bg-indigo-50 text-indigo-700",
  failed: "bg-red-50 text-red-700",
};

export function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  // Debounce: only search 300 ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search === q) return;
      setParams(search ? { q: search } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["reviews", { page, q }],
    queryFn: () => listReviews({ page, q }),
    placeholderData: keepPreviousData, // keep the old page visible while the next one loads
  });

  const goTo = (p: number) => setParams({ ...(q ? { q } : {}), page: String(p) });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        {isFetching && !isPending && <Spinner className="h-4 w-4" />}
        <input type="search" aria-label="Search reviews by title" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} ml-auto sm:max-w-xs`} />
      </div>

      {isPending ? (
        <div className="space-y-3" aria-label="Loading reviews">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </div>
      ) : isError ? (
        <ErrorBanner message={error.message} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title={q ? `No reviews match “${q}”` : "No reviews yet"}>
          {!q && (
            <Link to="/" className="font-medium text-indigo-600 hover:underline">Start your first review</Link>
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link to={`/reviews/${r.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                    <span className="ml-auto text-xs text-slate-500">
                      {languageLabel(r.language)} · {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {r.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.summary}</p>}
                  {r.status === "done" && <div className="mt-2"><IssueCounts counts={r.issueCounts} /></div>}
                </Link>
              </li>
            ))}
          </ul>
          {data.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
              <button disabled={page <= 1} onClick={() => goTo(page - 1)} className={secondaryButtonClass}>Previous</button>
              <span className="text-sm text-slate-600">Page {page} of {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => goTo(page + 1)} className={secondaryButtonClass}>Next</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
