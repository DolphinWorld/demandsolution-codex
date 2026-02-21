import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mapIdea, mapTask } from "@/lib/db-mappers";
import { getAnonId, getNickname } from "@/lib/identity";
import { IdeaDetailClient } from "@/components/IdeaDetailClient";
import { auth } from "@/auth";
import { canDeleteIdea } from "@/lib/permissions";

const ALLOWED_STATUS = new Set(["OPEN", "IN_PROGRESS", "DONE"] as const);

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const anonId = await getAnonId();
  const nickname = await getNickname();
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      createdByUser: { include: { developerProfile: true } },
      workVotes: true,
      userVotes: true,
      votes: true,
      tasks: {
        include: {
          links: true,
          claimedByUser: { include: { developerProfile: true } },
          workVotes: true,
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          createdByUser: { include: { developerProfile: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      solutions: {
        include: {
          createdByUser: { include: { developerProfile: true } },
          userVotes: true,
          anonVotes: true,
          comments: true,
          task: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      merges: { select: { id: true } },
    },
  });

  if (!idea) {
    notFound();
  }

  const isVoted = userId
    ? idea.userVotes.some((vote) => vote.userId === userId)
    : idea.votes.some((vote) => vote.anonId === anonId);

  const claimedAnonIds = Array.from(
    new Set(idea.tasks.map((task) => task.claimedByAnonId).filter((value): value is string => Boolean(value)))
  );
  const claimantNicknames = claimedAnonIds.length
    ? await prisma.nickname.findMany({
        where: { anonId: { in: claimedAnonIds } },
      })
    : [];
  const nicknameByAnonId = new Map(claimantNicknames.map((row) => [row.anonId, row.nickname]));

  const payload = {
    ...mapIdea(idea),
    submitter_label: idea.isAnonymous
      ? "Anonymous"
      : idea.submitterVisibleName || idea.createdByUser?.developerProfile?.displayName || idea.createdByUser?.name || "Member",
    viewerAnonId: anonId,
    viewerUserId: userId,
    isAuthenticated: Boolean(userId),
    canApproveSolutions: Boolean(userId ? idea.createdByUserId === userId : !idea.createdByUserId && idea.createdByAnonId === anonId),
    canDelete: canDeleteIdea({
      ideaOwnerUserId: idea.createdByUserId,
      ideaOwnerAnonId: idea.createdByAnonId,
      actorUserId: userId,
      actorAnonId: anonId || null,
      actorEmail: session?.user?.email,
    }),
    merged_submission_count: idea.merges.length,
    idea_working_count: idea.workVotes.length,
    idea_working: userId ? idea.workVotes.some((vote) => vote.userId === userId) : false,
    tasks: idea.tasks.map((task) => {
      const mapped = mapTask(task);
      const claimantDisplayName = task.claimedByUserId
        ? task.claimedByUser?.developerProfile?.displayName || task.claimedByUser?.name || "Member"
        : mapped.claimedByAnonId
          ? nicknameByAnonId.get(mapped.claimedByAnonId) ?? "anon"
          : null;

      return {
        ...mapped,
        claimantNickname: claimantDisplayName,
        claimantDisplayName,
        working_count: task.workVotes.length,
        working: userId ? task.workVotes.some((vote) => vote.userId === userId) : false,
        status: ALLOWED_STATUS.has(mapped.status as "OPEN" | "IN_PROGRESS" | "DONE")
          ? (mapped.status as "OPEN" | "IN_PROGRESS" | "DONE")
          : "OPEN",
      };
    }),
    comments: idea.comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      author_label:
        comment.createdByUser?.developerProfile?.displayName || comment.createdByUser?.name || (comment.createdByUserId ? "Member" : "Anon"),
    })),
    solutions: idea.solutions.map((solution) => {
      const userScore = solution.userVotes.reduce((sum, vote) => sum + vote.value, 0);
      const anonScore = solution.anonVotes.reduce((sum, vote) => sum + vote.value, 0);
      const myVote = userId
        ? solution.userVotes.find((vote) => vote.userId === userId)?.value ?? 0
        : solution.anonVotes.find((vote) => vote.anonId === anonId)?.value ?? 0;

      return {
        id: solution.id,
        ideaId: solution.ideaId,
        taskId: solution.taskId,
        taskTitle: solution.task?.title ?? null,
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
    }),
  };

  return <IdeaDetailClient initialIdea={payload} isVoted={isVoted} initialNickname={nickname} />;
}
