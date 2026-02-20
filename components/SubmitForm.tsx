"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchWithAnon } from "@/lib/client-anon";

function parseErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "Failed to generate requirements.";

  const value = error as Record<string, unknown>;
  if (typeof value.error === "string") return value.error;
  if (typeof value.detail === "string") return value.detail;

  return "Failed to generate requirements.";
}

export function SubmitForm({ canShowIdentity }: { canShowIdentity: boolean }) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [platform, setPlatform] = useState("Any");
  const [constraints, setConstraints] = useState("");
  const [showName, setShowName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chars = useMemo(() => rawText.length, [rawText.length]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetchWithAnon("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_input_text: rawText,
          target_users: targetUsers || undefined,
          platform: platform === "Any" ? undefined : platform,
          constraints: constraints || undefined,
          show_name: showName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(parseErrorMessage(data));
      }

      router.push(`/ideas/${data.idea.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card reveal-up space-y-5" style={{ animationDelay: "80ms" }}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-sm font-semibold">Idea text</label>
            <span className={`text-xs ${chars < 20 ? "text-red-700" : "subtle"}`}>{chars}/3000</span>
          </div>
          <textarea
            required
            minLength={20}
            maxLength={3000}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="input min-h-52"
            placeholder="Example: A neighborhood demand board where residents post local pain points and developers build solutions..."
          />
          <p className="subtle mt-2 text-xs">Be concrete about the problem and expected outcome to get better generated tasks.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Target users (optional)</label>
          <input
            value={targetUsers}
            onChange={(e) => setTargetUsers(e.target.value)}
            className="input"
            placeholder="Independent creators, student teams, local shops..."
            maxLength={300}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Platform preference (optional)</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
            <option>Any</option>
            <option>Web</option>
            <option>Mobile</option>
            <option>Desktop</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold">Constraints (optional)</label>
          <input
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            className="input"
            placeholder="No login, privacy-first, low budget, integrate with GitHub only..."
            maxLength={500}
          />
        </div>

        <div className="md:col-span-2 rounded-xl border border-zinc-200 bg-white/70 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={showName}
              onChange={(e) => setShowName(e.target.checked)}
              disabled={!canShowIdentity}
            />
            Show my name publicly as idea submitter
          </label>
          {!canShowIdentity ? (
            <p className="subtle mt-2 text-xs">
              Login is required to publish with your visible name. <Link href="/login" className="underline">Sign in</Link>
            </p>
          ) : (
            <p className="subtle mt-2 text-xs">Default remains anonymous even when logged in.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
        Disclaimer: this is a best-effort generated specification. Review tasks and open questions before building.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={loading} className="btn btn-primary min-w-52">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
              Generating requirements...
            </span>
          ) : (
            "Generate Requirements"
          )}
        </button>
        <p className="subtle text-xs">Rate-limited to 5 submissions/hour per anonymous identity and IP.</p>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
