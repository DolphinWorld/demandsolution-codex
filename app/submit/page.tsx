import { auth } from "@/auth";
import { SubmitForm } from "@/components/SubmitForm";

export default async function SubmitPage() {
  const session = await auth();

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="hero-panel reveal-up">
        <p className="kicker">Submit Demand</p>
        <h1 className="section-title mt-2 text-3xl md:text-4xl">Generate a public requirements board from your idea.</h1>
        <p className="subtle mt-3 max-w-3xl text-sm md:text-base">
          Describe the product need in plain language. The system will produce a buildable spec with core features, actionable
          tasks, and open questions.
        </p>
      </section>
      <SubmitForm canShowIdentity={Boolean(session?.user?.id)} />
    </div>
  );
}
