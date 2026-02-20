import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapIdea, mapTask } from "@/lib/db-mappers";
import { getAnonId } from "@/lib/identity";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { id } = await params;

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
    },
  });

  if (!idea) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const claimedAnonIds = Array.from(
    new Set(idea.tasks.map((task) => task.claimedByAnonId).filter((value): value is string => Boolean(value)))
  );
  const claimantNicknames = claimedAnonIds.length
    ? await prisma.nickname.findMany({ where: { anonId: { in: claimedAnonIds } } })
    : [];
  const nicknameByAnonId = new Map(claimantNicknames.map((row) => [row.anonId, row.nickname]));

  const isVoted = userId
    ? idea.userVotes.some((vote) => vote.userId === userId)
    : idea.votes.some((vote) => vote.anonId === anonId);

  return NextResponse.json({
    idea: {
      ...mapIdea(idea),
      submitter_label: idea.isAnonymous
        ? "Anonymous"
        : idea.submitterVisibleName || idea.createdByUser?.developerProfile?.displayName || idea.createdByUser?.name || "Member",
      viewerAnonId: anonId,
      viewerUserId: userId,
      canApproveSolutions: Boolean(userId ? idea.createdByUserId === userId : !idea.createdByUserId && idea.createdByAnonId === anonId),
      isVoted,
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
        };
      }),
      comments: idea.comments.map((comment) => ({
        ...comment,
        author_label:
          comment.createdByUser?.developerProfile?.displayName || comment.createdByUser?.name || (comment.createdByUserId ? "Member" : "Anon"),
      })),
    },
  });
}
