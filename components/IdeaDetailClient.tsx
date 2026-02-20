"use client";

import { useMemo, useState } from "react";
import { fetchWithAnon } from "@/lib/client-anon";

type LinkItem = {
  id: string;
  url: string;
  label: string | null;
  createdByAnonId: string;
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  acceptance_criteria: string[];
  effort: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  claimedByAnonId: string | null;
  claimantNickname: string | null;
  links: LinkItem[];
};

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
};

type IdeaPayload = {
  id: string;
  title: string;
  problemStatement: string;
  tags: string[];
  features: string[];
  open_questions: string[];
  upvotesCount: number;
  commentsCount: number;
  viewerAnonId: string;
  tasks: TaskItem[];
  comments: CommentItem[];
};

type TaskUpdate = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  claimedByAnonId: string | null;
  claimantNickname?: string | null;
  links?: LinkItem[];
};

function formatStatus(status: TaskItem["status"]): string {
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "DONE") return "Done";
  return "Open";
}

export function IdeaDetailClient({
  initialIdea,
  isVoted,
  initialNickname,
}: {
  initialIdea: IdeaPayload;
  isVoted: boolean;
  initialNickname: string;
}) {
  const [idea, setIdea] = useState(initialIdea);
  const [voted, setVoted] = useState(isVoted);
  const [nickname, setNickname] = useState(initialNickname);
  const [nickInput, setNickInput] = useState(initialNickname);
  const [commentInput, setCommentInput] = useState("");

  function applyTaskUpdate(taskId: string, taskUpdate: TaskUpdate) {
    setIdea((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const nextClaimedBy = taskUpdate.claimedByAnonId;
        const nextClaimantNickname =
          taskUpdate.claimantNickname !== undefined
            ? taskUpdate.claimantNickname
            : nextClaimedBy === prev.viewerAnonId
              ? nickname || "anon"
              : task.claimantNickname;

        return {
          ...task,
          status: taskUpdate.status,
          claimedByAnonId: nextClaimedBy,
          claimantNickname: nextClaimedBy ? nextClaimantNickname ?? "anon" : null,
          links: taskUpdate.links ?? task.links,
        };
      }),
    }));
  }

  async function toggleVote() {
    const next = !voted;
    setVoted(next);
    setIdea((prev) => ({ ...prev, upvotesCount: prev.upvotesCount + (next ? 1 : -1) }));

    const method = next ? "POST" : "DELETE";
    const response = await fetchWithAnon(`/api/ideas/${idea.id}/upvote`, { method });
    if (!response.ok) {
      setVoted(!next);
      setIdea((prev) => ({ ...prev, upvotesCount: prev.upvotesCount + (next ? -1 : 1) }));
    }
  }

  async function saveNickname() {
    const response = await fetchWithAnon("/api/me/nickname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nickInput }),
    });

    if (response.ok) {
      setNickname(nickInput);
      setIdea((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.claimedByAnonId === prev.viewerAnonId ? { ...task, claimantNickname: nickInput || "anon" } : task
        ),
      }));
    }
  }

  async function addComment() {
    const body = commentInput.trim();
    if (!body) return;

    const response = await fetchWithAnon(`/api/ideas/${idea.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (!response.ok) return;
    const data = await response.json();

    setIdea((prev) => ({
      ...prev,
      commentsCount: prev.commentsCount + 1,
      comments: [data.comment, ...prev.comments],
    }));
    setCommentInput("");
  }

  async function claim(taskId: string) {
    const response = await fetchWithAnon(`/api/tasks/${taskId}/claim`, { method: "POST" });
    if (!response.ok) return;

    const data = await response.json();
    applyTaskUpdate(taskId, data.task);
  }

  async function unclaim(taskId: string) {
    const response = await fetchWithAnon(`/api/tasks/${taskId}/unclaim`, { method: "POST" });
    if (!response.ok) return;

    const data = await response.json();
    applyTaskUpdate(taskId, data.task);
  }

  async function setStatus(taskId: string, status: TaskItem["status"]) {
    const response = await fetchWithAnon(`/api/tasks/${taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return;

    const data = await response.json();
    applyTaskUpdate(taskId, data.task);
  }

  async function addLink(taskId: string) {
    const url = window.prompt("Paste URL (repo/PR/demo)");
    if (!url) return;
    const label = window.prompt("Label (optional)") || undefined;

    const response = await fetchWithAnon(`/api/tasks/${taskId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label }),
    });

    if (!response.ok) return;
    const data = await response.json();

    setIdea((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, links: [...task.links, data.link] } : task)),
    }));
  }

  async function removeLink(taskId: string, linkId: string) {
    const response = await fetchWithAnon(`/api/task-links/${linkId}`, { method: "DELETE" });
    if (!response.ok) return;

    setIdea((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              links: task.links.filter((link) => link.id !== linkId),
            }
          : task
      ),
    }));
  }

  const grouped = useMemo(() => {
    return {
      open: idea.tasks.filter((task) => task.status === "OPEN"),
      inProgress: idea.tasks.filter((task) => task.status === "IN_PROGRESS"),
      done: idea.tasks.filter((task) => task.status === "DONE"),
    };
  }, [idea.tasks]);

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="hero-panel reveal-up">
        <p className="kicker">Generated Idea</p>
        <h1 className="section-title mt-2 text-3xl md:text-4xl">{idea.title}</h1>
        <p className="subtle mt-4 max-w-4xl text-sm md:text-base">{idea.problemStatement}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {idea.tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 md:gap-3">
          <button className={`btn ${voted ? "btn-primary" : ""}`} onClick={toggleVote}>
            {voted ? "Upvoted" : "Upvote"} ({idea.upvotesCount})
          </button>
          <span className="pill">{idea.commentsCount} comments</span>
          <span className="pill">{idea.tasks.length} tasks</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 reveal-up" style={{ animationDelay: "80ms" }}>
        <div className="card">
          <h2 className="section-title text-xl">Core Features</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {idea.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="section-title text-xl">Open Questions</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {idea.open_questions.length ? idea.open_questions.map((question) => <li key={question}>{question}</li>) : <li>None</li>}
          </ul>
        </div>
      </section>

      <section className="card reveal-up space-y-4" style={{ animationDelay: "140ms" }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Developer Identity</h2>
            <p className="subtle mt-1 text-sm">Set a nickname shown when you claim tasks.</p>
          </div>
          <span className="pill">Current: {nickname || "anon"}</span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full max-w-sm">
            <label className="mb-1.5 block text-sm font-medium">Nickname</label>
            <input className="input" value={nickInput} onChange={(event) => setNickInput(event.target.value)} />
          </div>
          <button className="btn" onClick={saveNickname}>
            Save Nickname
          </button>
        </div>
      </section>

      <section className="card reveal-up space-y-4" style={{ animationDelay: "180ms" }}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="section-title">Tasks</h2>
            <p className="subtle mt-1 text-sm">Claim tasks, attach implementation links, and move status to done.</p>
          </div>
        </div>

        <TaskColumn
          title="Open"
          items={grouped.open}
          viewerAnonId={idea.viewerAnonId}
          onClaim={claim}
          onUnclaim={unclaim}
          onSetStatus={setStatus}
          onAddLink={addLink}
          onRemoveLink={removeLink}
        />
        <TaskColumn
          title="In Progress"
          items={grouped.inProgress}
          viewerAnonId={idea.viewerAnonId}
          onClaim={claim}
          onUnclaim={unclaim}
          onSetStatus={setStatus}
          onAddLink={addLink}
          onRemoveLink={removeLink}
        />
        <TaskColumn
          title="Done"
          items={grouped.done}
          viewerAnonId={idea.viewerAnonId}
          onClaim={claim}
          onUnclaim={unclaim}
          onSetStatus={setStatus}
          onAddLink={addLink}
          onRemoveLink={removeLink}
        />
      </section>

      <section className="card reveal-up space-y-4" style={{ animationDelay: "240ms" }}>
        <div className="flex items-end justify-between gap-2">
          <h2 className="section-title">Comments</h2>
          <span className="pill">{idea.commentsCount} total</span>
        </div>

        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="input"
            value={commentInput}
            onChange={(event) => setCommentInput(event.target.value)}
            placeholder="Add a comment"
          />
          <button className="btn btn-primary md:min-w-28" onClick={addComment}>
            Post
          </button>
        </div>

        <div className="space-y-2">
          {idea.comments.length ? (
            idea.comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-white/70 bg-white/60 p-3 text-sm">
                <p>{comment.body}</p>
                <p className="subtle mt-1 text-xs">{new Date(comment.createdAt).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p className="subtle text-sm">No comments yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function statusBadgeClass(status: TaskItem["status"]): string {
  if (status === "DONE") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-sky-100 text-sky-700 border-sky-200";
}

function TaskColumn({
  title,
  items,
  viewerAnonId,
  onClaim,
  onUnclaim,
  onSetStatus,
  onAddLink,
  onRemoveLink,
}: {
  title: string;
  items: TaskItem[];
  viewerAnonId: string;
  onClaim: (taskId: string) => Promise<void>;
  onUnclaim: (taskId: string) => Promise<void>;
  onSetStatus: (taskId: string, status: TaskItem["status"]) => Promise<void>;
  onAddLink: (taskId: string) => Promise<void>;
  onRemoveLink: (taskId: string, linkId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-600">{title}</h3>
      {items.length === 0 ? <p className="subtle text-sm">No tasks.</p> : null}
      {items.map((task) => {
        const isClaimedByMe = task.claimedByAnonId === viewerAnonId;
        const isClaimedBySomeoneElse = Boolean(task.claimedByAnonId) && !isClaimedByMe;

        return (
          <details key={task.id} className="rounded-xl border border-white/70 bg-white/70 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              <span>{task.title}</span>
              <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(task.status)}`}>
                {formatStatus(task.status)}
              </span>
              {task.effort ? <span className="ml-2 text-xs text-zinc-500">Effort {task.effort}</span> : null}
            </summary>

            <div className="mt-3 space-y-2 text-sm">
              {task.description ? <p>{task.description}</p> : null}
              {task.claimedByAnonId ? (
                <p className="text-xs text-zinc-600">
                  Claimed by <span className="font-medium">{task.claimantNickname || "anon"}</span>
                </p>
              ) : (
                <p className="text-xs text-zinc-600">Unclaimed</p>
              )}

              {task.acceptance_criteria.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {task.acceptance_criteria.map((criteria) => (
                    <li key={criteria}>{criteria}</li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!task.claimedByAnonId ? (
                  <button className="btn" onClick={() => onClaim(task.id)}>
                    Claim
                  </button>
                ) : null}

                {isClaimedByMe ? (
                  <>
                    <button className="btn" onClick={() => onUnclaim(task.id)}>
                      Unclaim
                    </button>
                    <button className="btn" onClick={() => onSetStatus(task.id, "IN_PROGRESS")}>
                      In Progress
                    </button>
                    <button className="btn" onClick={() => onSetStatus(task.id, "DONE")}>
                      Done
                    </button>
                    <button className="btn" onClick={() => onSetStatus(task.id, "OPEN")}>
                      Open
                    </button>
                    <button className="btn" onClick={() => onAddLink(task.id)}>
                      Add Link
                    </button>
                  </>
                ) : null}

                {isClaimedBySomeoneElse ? <span className="subtle text-xs">Only claimant can update this task.</span> : null}
              </div>

              <div className="space-y-1.5">
                {task.links.map((link) => {
                  const canRemove = isClaimedByMe || link.createdByAnonId === viewerAnonId;
                  return (
                    <div key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white/90 px-2 py-1">
                      <a href={link.url} target="_blank" rel="noreferrer" className="truncate text-cyan-700 underline">
                        {link.label || link.url}
                      </a>
                      {canRemove ? (
                        <button className="text-xs text-zinc-500" onClick={() => onRemoveLink(task.id, link.id)}>
                          remove
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
