"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export function HomeList() {
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IdeaCard[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/ideas?sort=${sort}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load ideas");
        }
        return data;
      })
      .then((data) => {
        if (active) setItems(data.items || []);
      })
      .catch((err) => {
        if (active) {
          setItems([]);
          setError(err instanceof Error ? err.message : "Failed to load ideas");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sort]);

  const empty = useMemo(() => !loading && !error && items.length === 0, [loading, error, items.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 p-1">
          <button onClick={() => setSort("hot")} className={`btn rounded-full px-4 ${sort === "hot" ? "btn-primary" : ""}`}>
            Hot
          </button>
          <button onClick={() => setSort("new")} className={`btn rounded-full px-4 ${sort === "new" ? "btn-primary" : ""}`}>
            New
          </button>
        </div>
        <p className="subtle text-sm">{items.length} ideas</p>
      </div>

      {loading ? <p className="subtle text-sm">Loading ideas...</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {empty ? <p className="subtle text-sm">No ideas yet. Be the first to submit one.</p> : null}

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
    </div>
  );
}
