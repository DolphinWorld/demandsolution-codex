import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";
import { buildMeaningfulTitle } from "@/lib/title";
import { SolutionsListClient } from "@/components/SolutionsListClient";

export default async function IdeaSolutionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      rawInputText: true,
      problemStatement: true,
      createdByUserId: true,
      createdByAnonId: true,
    },
  });

  if (!idea) {
    notFound();
  }

  const canApproveSolutions = Boolean(userId ? idea.createdByUserId === userId : !idea.createdByUserId && idea.createdByAnonId === anonId);

  const solutions = await prisma.solution.findMany({
    where: { ideaId: id },
    include: {
      createdByUser: { include: { developerProfile: true } },
      userVotes: true,
      anonVotes: true,
      comments: true,
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = solutions.map((solution) => {
    const userScore = solution.userVotes.reduce((sum, vote) => sum + vote.value, 0);
    const anonScore = solution.anonVotes.reduce((sum, vote) => sum + vote.value, 0);
    const myVote = userId
      ? solution.userVotes.find((vote) => vote.userId === userId)?.value ?? 0
      : solution.anonVotes.find((vote) => vote.anonId === anonId)?.value ?? 0;

    return {
      id: solution.id,
      ideaId: solution.ideaId,
      taskId: solution.taskId,
      taskTitle: solution.task?.title || null,
      url: solution.url,
      label: solution.label,
      description: solution.description,
      type: solution.type,
      createdAt: solution.createdAt.toISOString(),
      approvedAt: solution.approvedAt ? solution.approvedAt.toISOString() : null,
      createdByDisplayName:
        solution.createdByUser.developerProfile?.displayName || solution.createdByUser.name || solution.createdByUser.email || "Developer",
      voteScore: userScore + anonScore,
      myVote,
      commentsCount: solution.comments.length,
    };
  });

  const ideaTitle = buildMeaningfulTitle({
    rawInputText: idea.rawInputText,
    title: idea.title,
    problemStatement: idea.problemStatement,
  });

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="hero-panel reveal-up">
        <p className="kicker">Solutions Board</p>
        <h1 className="section-title mt-2 text-3xl md:text-4xl">{ideaTitle}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/ideas/${id}`} className="btn">Back to Idea</Link>
        </div>
      </section>

      <SolutionsListClient initialSolutions={mapped} canApproveSolutions={canApproveSolutions} />
    </div>
  );
}
