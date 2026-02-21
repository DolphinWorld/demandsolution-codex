"use client";

import { useState } from "react";
import { fetchWithAnon } from "@/lib/client-anon";

type SolutionItem = {
  id: string;
  ideaId: string;
  taskId: string | null;
  taskTitle: string | null;
  url: string;
  label: string | null;
  description: string | null;
  type: "APP_URL" | "GITHUB_REPO" | "OTHER";
  createdAt: string;
  approvedAt: string | null;
  createdByDisplayName: string;
  voteScore: number;
  myVote: number;
  commentsCount: number;
};

type SolutionCommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author_label?: string;
};

export function SolutionsListClient({
  initialSolutions,
  canApproveSolutions,
}: {
  initialSolutions: SolutionItem[];
  canApproveSolutions: boolean;
}) {
  const [solutions, setSolutions] = useState<SolutionItem[]>(initialSolutions);
  const [solutionComments, setSolutionComments] = useState<Record<string, SolutionCommentItem[]>>({});
  const [solutionCommentInput, setSolutionCommentInput] = useState<Record<string, string>>({});

  async function setSolutionVote(solutionId: string, value: number) {
    const current = solutions.find((solution) => solution.id === solutionId)?.myVote || 0;
    const response =
      current === value
        ? await fetchWithAnon(`/api/solutions/${solutionId}/vote`, { method: "DELETE" })
        : await fetchWithAnon(`/api/solutions/${solutionId}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          });

    if (!response.ok) return;
    const data = await response.json();

    setSolutions((prev) =>
      prev.map((solution) =>
        solution.id === solutionId
          ? {
              ...solution,
              voteScore: data.score,
              myVote: data.myVote,
            }
          : solution
      )
    );
  }

  async function approveSolution(solutionId: string) {
    const response = await fetchWithAnon(`/api/solutions/${solutionId}/approve`, { method: "POST" });
    if (!response.ok) return;

    const data = await response.json();
    const approvedAt = data.solution?.approvedAt || new Date().toISOString();
    setSolutions((prev) => prev.map((solution) => (solution.id === solutionId ? { ...solution, approvedAt } : solution)));
  }

  async function loadSolutionComments(solutionId: string) {
    const response = await fetchWithAnon(`/api/solutions/${solutionId}/comments`);
    if (!response.ok) return;

    const data = await response.json();
    setSolutionComments((prev) => ({ ...prev, [solutionId]: data.items || [] }));
  }

  async function addSolutionComment(solutionId: string) {
    const body = (solutionCommentInput[solutionId] || "").trim();
    if (!body) return;

    const response = await fetchWithAnon(`/api/solutions/${solutionId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) return;

    const data = await response.json();
    setSolutionComments((prev) => ({ ...prev, [solutionId]: data.items || [] }));
    setSolutionCommentInput((prev) => ({ ...prev, [solutionId]: "" }));
    setSolutions((prev) =>
      prev.map((solution) => (solution.id === solutionId ? { ...solution, commentsCount: (data.items || []).length } : solution))
    );
  }

  return (
    <section className="card reveal-up space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="section-title">Submitted Solutions</h2>
          <p className="subtle mt-1 text-sm">Community can vote/comment. Idea submitter can approve a solution.</p>
        </div>
      </div>

      <div className="space-y-2">
        {solutions.length === 0 ? <p className="subtle text-sm">No solutions submitted yet.</p> : null}
        {solutions.map((solution) => (
          <details key={solution.id} className="rounded-xl border border-zinc-200 bg-white/65 p-3">
            <summary className="cursor-pointer">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{solution.label || solution.url}</p>
                  <p className="subtle text-xs">
                    by {solution.createdByDisplayName}
                    {solution.taskTitle ? ` • task: ${solution.taskTitle}` : " • idea-level solution"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {solution.approvedAt ? <span className="pill">Approved</span> : null}
                  <span className="pill">Score {solution.voteScore}</span>
                  <span className="pill">{solution.commentsCount} comments</span>
                </div>
              </div>
            </summary>

            <div className="mt-3 space-y-2 text-sm">
              <a href={solution.url} target="_blank" rel="noreferrer" className="text-cyan-700 underline">{solution.url}</a>
              {solution.description ? <p>{solution.description}</p> : null}
              <p className="subtle text-xs">{new Date(solution.createdAt).toLocaleString()}</p>

              <div className="flex flex-wrap gap-2">
                <button className={`btn ${solution.myVote === 1 ? "btn-primary" : ""}`} onClick={() => setSolutionVote(solution.id, 1)}>
                  Like
                </button>
                <button className={`btn ${solution.myVote === -1 ? "btn-primary" : ""}`} onClick={() => setSolutionVote(solution.id, -1)}>
                  Unlike
                </button>
                {canApproveSolutions && !solution.approvedAt ? (
                  <button className="btn" onClick={() => approveSolution(solution.id)}>
                    Approve Solution
                  </button>
                ) : null}
                <button className="btn" onClick={() => loadSolutionComments(solution.id)}>
                  Load Comments
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  className="input"
                  value={solutionCommentInput[solution.id] || ""}
                  onChange={(e) =>
                    setSolutionCommentInput((prev) => ({
                      ...prev,
                      [solution.id]: e.target.value,
                    }))
                  }
                  placeholder="Comment on this solution"
                />
                <button className="btn" onClick={() => addSolutionComment(solution.id)}>
                  Post
                </button>
              </div>

              {(solutionComments[solution.id] || []).map((comment) => (
                <div key={comment.id} className="rounded-lg border border-zinc-200 bg-white/90 p-2 text-xs">
                  <p>{comment.body}</p>
                  <p className="subtle mt-1">{comment.author_label || "Anon"} • {new Date(comment.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
