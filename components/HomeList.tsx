"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 20;

type IdeaCard = {
  id: string;
  title: string;
  problemStatement: string;
  tags: string[];
  upvotesCount: number;
  comment_count: number;
  createdAt: string;
  submitter_label?: string;
  idea_working_count?: number;
  working_developers?: string[];
};

function buildPageItems(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | string> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("left-ellipsis");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("right-ellipsis");
  }

  items.push(totalPages);
  return items;
}

export function HomeList() {
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IdeaCard[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  function changePage(nextPage: number) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    setPage(1);
  }, [sort, query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ sort });
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (query) {
      params.set("q", query);
    }

    fetch(`/api/ideas?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load ideas");
        }
        return data;
      })
      .then((data) => {
        if (active) {
          const nextItems = data.items || [];
          setItems(nextItems);
          setTotalCount(typeof data.totalCount === "number" ? data.totalCount : nextItems.length);
          setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 0);
          if (typeof data.currentPage === "number") {
            setPage(data.currentPage);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setItems([]);
          setTotalCount(0);
          setTotalPages(0);
          setError(err instanceof Error ? err.message : "Failed to load ideas");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, sort, query]);

  const empty = useMemo(() => !loading && !error && items.length === 0, [loading, error, items.length]);
  const visibleCount = items.length;
  const startItem = visibleCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endItem = visibleCount > 0 ? startItem + visibleCount - 1 : 0;
  const summaryLabel =
    totalCount !== null && visibleCount > 0 && visibleCount < totalCount
      ? `Showing ${startItem}-${endItem} of ${totalCount} ideas`
      : `${totalCount ?? visibleCount} ideas`;
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className="space-y-4">
      <div className="card p-4 md:p-5">
        <label className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-600" htmlFor="idea-search-input">
          Search Ideas
        </label>
        <p className="subtle mt-1 text-sm">Fuzzy search supports approximate terms and minor typos.</p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            id="idea-search-input"
            type="search"
            className="input w-full rounded-full px-5 py-3 text-base"
            placeholder="Search by problem, keywords, or rough phrasing"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            aria-label="Search ideas"
          />
          {queryInput ? (
            <button type="button" className="btn rounded-full px-4" onClick={() => setQueryInput("")}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 p-1">
          <button onClick={() => setSort("hot")} className={`btn rounded-full px-4 ${sort === "hot" ? "btn-primary" : ""}`}>
            Hot
          </button>
          <button onClick={() => setSort("new")} className={`btn rounded-full px-4 ${sort === "new" ? "btn-primary" : ""}`}>
            New
          </button>
        </div>
        <p className="subtle text-sm">
          {summaryLabel}
          {query ? ` matching "${query}"` : ""}
        </p>
      </div>

      {loading ? <p className="subtle text-sm">Loading ideas...</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {empty ? (
        <p className="subtle text-sm">{query ? `No ideas found for "${query}".` : "No ideas yet. Be the first to submit one."}</p>
      ) : null}

      <div className="grid gap-3">
        {items.map((idea, index) => {
          const workers = idea.working_developers || [];
          const isExpanded = Boolean(expanded[idea.id]);

          return (
            <article key={idea.id} className="card reveal-up" style={{ animationDelay: `${Math.min(index * 45, 240)}ms` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/ideas/${idea.id}`} className="text-base font-semibold md:text-lg hover:underline">
                  {idea.title}
                </Link>
                <span className="subtle text-xs">{new Date(idea.createdAt).toLocaleString()}</span>
              </div>

              <p className="subtle mt-2 text-sm">{idea.problemStatement}</p>
              <p className="subtle mt-2 text-xs">Submitter: {idea.submitter_label || "Anonymous"}</p>

              {idea.tags.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {idea.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="badge">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2 md:max-w-md">
                <div className="metric">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Upvotes</p>
                  <p className="mt-1 text-sm font-semibold">{idea.upvotesCount}</p>
                </div>
                <div className="metric">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Comments</p>
                  <p className="mt-1 text-sm font-semibold">{idea.comment_count}</p>
                </div>
                <button
                  type="button"
                  className="metric text-left"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [idea.id]: !prev[idea.id],
                    }))
                  }
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Developers working</p>
                  <p className="mt-1 text-sm font-semibold">{idea.idea_working_count ?? workers.length}</p>
                </button>
              </div>

              {isExpanded ? (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-white/85 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Developer list</p>
                  {workers.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {workers.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="subtle mt-2 text-sm">No developers have marked this topic yet.</p>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="subtle text-sm">
            Page {page} of {totalPages}
          </p>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Ideas pagination">
            <button
              type="button"
              className="btn rounded-full px-4"
              onClick={() => changePage(page - 1)}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            {pageItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  className={`btn min-w-10 rounded-full px-4 ${item === page ? "btn-primary" : ""}`}
                  onClick={() => changePage(item)}
                  aria-current={item === page ? "page" : undefined}
                  disabled={loading}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="subtle px-1 text-sm" aria-hidden="true">
                  ...
                </span>
              )
            )}
            <button
              type="button"
              className="btn rounded-full px-4"
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
