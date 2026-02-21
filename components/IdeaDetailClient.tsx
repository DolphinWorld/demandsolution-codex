"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchWithAnon } from "@/lib/client-anon";

type LinkItem = {
  id: string;
  url: string;
  label: string | null;
  createdByAnonId: string | null;
  createdByUserId: string | null;
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  acceptance_criteria: string[];
  effort: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  claimedByAnonId: string | null;
  claimedByUserId: string | null;
  claimantNickname: string | null;
  claimantDisplayName: string | null;
  links: LinkItem[];
  working_count: number;
  working: boolean;
};

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author_label?: string;
};

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

type IdeaPayload = {
  id: string;
  title: string;
  problemStatement: string;
  rawInputText: string;
  targetUsers: string | null;
  platform: string | null;
  constraints: string | null;
  tags: string[];
  features: string[];
  open_questions: string[];
  upvotesCount: number;
  commentsCount: number;
  submitter_label: string;
  viewerAnonId: string;
  viewerUserId: string | null;
  isAuthenticated: boolean;
  canApproveSolutions: boolean;
  canDelete: boolean;
  merged_submission_count: number;
  idea_working_count: number;
  idea_working: boolean;
  tasks: TaskItem[];
  comments: CommentItem[];
  solutions: SolutionItem[];
};

type TaskUpdate = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE";
  claimedByAnonId: string | null;
  claimedByUserId: string | null;
  claimantNickname?: string | null;
  claimantDisplayName?: string | null;
  links?: LinkItem[];
};

type SolutionCommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author_label?: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idea, setIdea] = useState(initialIdea);
  const [voted, setVoted] = useState(isVoted);
  const [nickname, setNickname] = useState(initialNickname);
  const [nickInput, setNickInput] = useState(initialNickname);
  const [commentInput, setCommentInput] = useState("");

  const [solutions, setSolutions] = useState<SolutionItem[]>(initialIdea.solutions || []);
  const [solutionUrl, setSolutionUrl] = useState("");
  const [solutionLabel, setSolutionLabel] = useState("");
  const [solutionDescription, setSolutionDescription] = useState("");
  const [solutionType, setSolutionType] = useState<"APP_URL" | "GITHUB_REPO" | "OTHER">("APP_URL");
  const [solutionTaskId, setSolutionTaskId] = useState<string>("");

  const [solutionComments, setSolutionComments] = useState<Record<string, SolutionCommentItem[]>>({});
  const [solutionCommentInput, setSolutionCommentInput] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");

  const mergeNotice = useMemo(() => {
    if (searchParams.get("merged") !== "1") return "";
    return searchParams.get("reason") === "SUBSET"
      ? "Your submission was merged: it is a subset of this existing idea."
      : "Your submission was merged: this idea already exists, so discussion stays in one thread.";
  }, [searchParams]);

  function applyTaskUpdate(taskId: string, taskUpdate: TaskUpdate) {
    setIdea((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const nextClaimedByUser = taskUpdate.claimedByUserId;
        const nextClaimedByAnon = taskUpdate.claimedByAnonId;
        const nextClaimantDisplayName =
          taskUpdate.claimantDisplayName ??
          taskUpdate.claimantNickname ??
          (nextClaimedByAnon === prev.viewerAnonId ? nickname || "anon" : task.claimantDisplayName);

        return {
          ...task,
          status: taskUpdate.status,
          claimedByUserId: nextClaimedByUser,
          claimedByAnonId: nextClaimedByAnon,
          claimantNickname: nextClaimantDisplayName,
          claimantDisplayName: nextClaimantDisplayName,
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

  async function toggleIdeaWorking() {
    if (!idea.isAuthenticated) return;

    const next = !idea.idea_working;
    const method = next ? "POST" : "DELETE";
    const response = await fetchWithAnon(`/api/ideas/${idea.id}/work-vote`, { method });
    if (!response.ok) return;

    const data = await response.json();
    setIdea((prev) => ({
      ...prev,
      idea_working: data.working,
      idea_working_count: data.working_count,
    }));
  }

  async function toggleTaskWorking(taskId: string, working: boolean) {
    if (!idea.isAuthenticated) return;

    const response = await fetchWithAnon(`/api/tasks/${taskId}/work-vote`, { method: working ? "DELETE" : "POST" });
    if (!response.ok) return;

    const data = await response.json();
    setIdea((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              working: data.working,
              working_count: data.working_count,
            }
          : task
      ),
    }));
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
          task.claimedByAnonId === prev.viewerAnonId ? { ...task, claimantNickname: nickInput || "anon", claimantDisplayName: nickInput || "anon" } : task
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

  async function submitSolution() {
    if (!idea.isAuthenticated) return;
    if (!solutionUrl.trim()) return;

    const response = await fetchWithAnon(`/api/ideas/${idea.id}/solutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: solutionTaskId || undefined,
        url: solutionUrl.trim(),
        label: solutionLabel.trim() || undefined,
        description: solutionDescription.trim() || undefined,
        type: solutionType,
      }),
    });

    if (!response.ok) return;
    const data = await response.json();
    setSolutions(data.items || []);
    setSolutionUrl("");
    setSolutionLabel("");
    setSolutionDescription("");
    setSolutionTaskId("");
    setSolutionType("APP_URL");
  }

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

  async function deleteIdea() {
    if (!idea.canDelete) return;

    const confirmed = window.confirm("Delete this post? This action cannot be undone.");
    if (!confirmed) return;

    setActionError("");
    const response = await fetchWithAnon(`/api/ideas/${idea.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setActionError((data && typeof data.error === "string" ? data.error : "Failed to delete post.") || "Failed to delete post.");
      return;
    }

    router.push("/");
    router.refresh();
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

        {mergeNotice ? (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{mergeNotice}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {idea.tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
          <span className="pill">Submitter: {idea.submitter_label}</span>
          <span className="pill">Merged submissions: {idea.merged_submission_count}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 md:gap-3">
          <button className={`btn ${voted ? "btn-primary" : ""}`} onClick={toggleVote}>
            {voted ? "Upvoted" : "Upvote"} ({idea.upvotesCount})
          </button>
          <button className={`btn ${idea.idea_working ? "btn-primary" : ""}`} onClick={toggleIdeaWorking} disabled={!idea.isAuthenticated}>
            Working on this ({idea.idea_working_count})
          </button>
          <span className="pill">{idea.commentsCount} comments</span>
          <span className="pill">{idea.tasks.length} tasks</span>
          {idea.canDelete ? (
            <button className="btn border-red-200 text-red-700 hover:bg-red-50" onClick={deleteIdea}>
              Delete Post
            </button>
          ) : null}
        </div>

        {actionError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p> : null}

        {!idea.isAuthenticated ? (
          <p className="subtle mt-2 text-xs">
            <Link href="/login" className="underline">Sign in</Link> to submit solutions and add developer work votes.
          </p>
        ) : null}
      </section>

      <section className="card reveal-up" style={{ animationDelay: "70ms" }}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="section-title text-xl">Original Submission</h2>
          {idea.platform ? <span className="pill">Platform: {idea.platform}</span> : null}
          {idea.targetUsers ? <span className="pill">Target: {idea.targetUsers}</span> : null}
        </div>
        {idea.constraints ? <p className="subtle mt-2 text-xs">Constraints: {idea.constraints}</p> : null}
        <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm leading-6">
          {idea.rawInputText}
        </p>
      </section>

      <section className="card reveal-up space-y-4" style={{ animationDelay: "180ms" }}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="section-title">Tasks</h2>
            <p className="subtle mt-1 text-sm">Claim tasks, attach implementation links, and vote to signal developer interest.</p>
          </div>
        </div>

        <TaskColumn
          title="Open"
          items={grouped.open}
          viewerAnonId={idea.viewerAnonId}
          viewerUserId={idea.viewerUserId}
          isAuthenticated={idea.isAuthenticated}
          onClaim={claim}
          onUnclaim={unclaim}
          onSetStatus={setStatus}
          onAddLink={addLink}
          onRemoveLink={removeLink}
          onToggleWorking={toggleTaskWorking}
        />
        <TaskColumn
          title="In Progress"
          items={grouped.inProgress}
          viewerAnonId={idea.viewerAnonId}
          viewerUserId={idea.viewerUserId}
          isAuthenticated={idea.isAuthenticated}
          onClaim={claim}
          onUnclaim={unclaim}
          onSetStatus={setStatus}
          onAddLink={addLink}
          onRemoveLink={removeLink}
          onToggleWorking={toggleTaskWorking}
        />
        <TaskColumn
          title="Done"
          items={grouped.done}
          viewerAnonId={idea.viewerAnonId}
          viewerUserId={idea.viewerUserId}
          isAuthenticated={idea.isAuthenticated}
          onClaim={claim}
          onUnclaim={unclaim}
          onSetStatus={setStatus}
          onAddLink={addLink}
          onRemoveLink={removeLink}
          onToggleWorking={toggleTaskWorking}
        />
      </section>

      <section className="card reveal-up space-y-4" style={{ animationDelay: "200ms" }}>
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="section-title">Solutions</h2>
            <p className="subtle mt-1 text-sm">Only developers who marked "Working on this" can submit solutions.</p>
          </div>
          <span className="pill">{solutions.length} submitted</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/ideas/${idea.id}/solutions`} className="btn">
            View Submitted Solutions
          </Link>
        </div>

        {idea.isAuthenticated && idea.idea_working ? (
          <div className="rounded-xl border border-zinc-200 bg-white/70 p-3">
            <div className="grid gap-2 md:grid-cols-2">
              <input className="input" value={solutionUrl} onChange={(e) => setSolutionUrl(e.target.value)} placeholder="Solution URL (app or repo)" />
              <input className="input" value={solutionLabel} onChange={(e) => setSolutionLabel(e.target.value)} placeholder="Label (optional)" />
              <select className="input" value={solutionType} onChange={(e) => setSolutionType(e.target.value as "APP_URL" | "GITHUB_REPO" | "OTHER")}>
                <option value="APP_URL">App URL</option>
                <option value="GITHUB_REPO">GitHub repo</option>
                <option value="OTHER">Other</option>
              </select>
              <select className="input" value={solutionTaskId} onChange={(e) => setSolutionTaskId(e.target.value)}>
                <option value="">For whole idea</option>
                {idea.tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <textarea
                className="input md:col-span-2 min-h-20"
                value={solutionDescription}
                onChange={(e) => setSolutionDescription(e.target.value)}
                placeholder="How this solution addresses the demand"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button className="btn btn-primary" onClick={submitSolution}>
                Submit Solution
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white/70 p-3 text-sm">
            {idea.isAuthenticated ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>Mark yourself as working on this idea first, then the solution form will appear.</span>
                <button className="btn" onClick={toggleIdeaWorking}>Working on this</button>
              </div>
            ) : (
              <p>
                <Link href="/login" className="underline">Sign in</Link> and click "Working on this" to submit a solution.
              </p>
            )}
          </div>
        )}
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
                <p className="subtle mt-1 text-xs">{comment.author_label || "Anon"} • {new Date(comment.createdAt).toLocaleString()}</p>
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
  viewerUserId,
  isAuthenticated,
  onClaim,
  onUnclaim,
  onSetStatus,
  onAddLink,
  onRemoveLink,
  onToggleWorking,
}: {
  title: string;
  items: TaskItem[];
  viewerAnonId: string;
  viewerUserId: string | null;
  isAuthenticated: boolean;
  onClaim: (taskId: string) => Promise<void>;
  onUnclaim: (taskId: string) => Promise<void>;
  onSetStatus: (taskId: string, status: TaskItem["status"]) => Promise<void>;
  onAddLink: (taskId: string) => Promise<void>;
  onRemoveLink: (taskId: string, linkId: string) => Promise<void>;
  onToggleWorking: (taskId: string, working: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-600">{title}</h3>
      {items.length === 0 ? <p className="subtle text-sm">No tasks.</p> : null}
      {items.map((task) => {
        const isClaimedByMe = viewerUserId
          ? task.claimedByUserId === viewerUserId
          : !task.claimedByUserId && task.claimedByAnonId === viewerAnonId;

        const isClaimedBySomeoneElse = Boolean(task.claimedByUserId || task.claimedByAnonId) && !isClaimedByMe;

        return (
          <details key={task.id} className="rounded-xl border border-white/70 bg-white/65 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              <span>{task.title}</span>
              <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(task.status)}`}>
                {formatStatus(task.status)}
              </span>
              {task.effort ? <span className="ml-2 text-xs text-zinc-500">Effort {task.effort}</span> : null}
              <span className="ml-2 text-xs text-zinc-500">Working votes {task.working_count}</span>
            </summary>

            <div className="mt-3 space-y-2 text-sm">
              {task.description ? <p>{task.description}</p> : null}
              {task.claimedByAnonId || task.claimedByUserId ? (
                <p className="text-xs text-zinc-600">
                  Claimed by <span className="font-medium">{task.claimantDisplayName || "anon"}</span>
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
                {!task.claimedByAnonId && !task.claimedByUserId ? (
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

                <button className={`btn ${task.working ? "btn-primary" : ""}`} onClick={() => onToggleWorking(task.id, task.working)} disabled={!isAuthenticated}>
                  I am working
                </button>

                {isClaimedBySomeoneElse ? <span className="subtle text-xs">Only claimant can update this task.</span> : null}
              </div>

              <div className="space-y-1.5">
                {task.links.map((link) => {
                  const canRemoveAsUser = Boolean(viewerUserId) && (link.createdByUserId === viewerUserId || task.claimedByUserId === viewerUserId);
                  const canRemoveAsAnon = !viewerUserId && (link.createdByAnonId === viewerAnonId || task.claimedByAnonId === viewerAnonId);
                  const canRemove = canRemoveAsUser || canRemoveAsAnon;

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
