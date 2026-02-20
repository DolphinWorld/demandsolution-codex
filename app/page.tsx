import Link from "next/link";
import { HomeList } from "@/components/HomeList";

export default function HomePage() {
  return (
    <div className="space-y-6 md:space-y-8">
      <section className="hero-panel reveal-up">
        <p className="kicker">Community Product Lab</p>
        <div className="mt-3 grid gap-5 md:grid-cols-[1.7fr_1fr] md:items-end">
          <div>
            <h1 className="section-title text-3xl md:text-5xl">Turn rough ideas into a build-ready requirements board.</h1>
            <p className="subtle mt-4 max-w-2xl text-sm md:text-base">
              Post a fuzzy concept, generate a structured spec with tasks, let the community validate demand, and let developers
              claim work with repo and PR links.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/submit" className="btn btn-primary">
                Start a New Idea
              </Link>
              <span className="pill">No login required</span>
              <span className="pill">Cookie-based identity</span>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="metric">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Input</p>
              <p className="mt-1 text-sm font-medium">Vague idea + constraints</p>
            </div>
            <div className="metric">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Output</p>
              <p className="mt-1 text-sm font-medium">Features, tasks, open questions</p>
            </div>
            <div className="metric">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Execution</p>
              <p className="mt-1 text-sm font-medium">Claim tasks and ship with links</p>
            </div>
          </div>
        </div>
      </section>

      <section className="reveal-up" style={{ animationDelay: "80ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Idea Board</h2>
          <p className="subtle text-sm">Sorted by hotness or recency</p>
        </div>
        <HomeList />
      </section>
    </div>
  );
}
