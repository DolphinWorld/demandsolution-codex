import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mapIdea, mapTask } from "@/lib/db-mappers";
import { getAnonId, getNickname } from "@/lib/identity";
import { IdeaDetailClient } from "@/components/IdeaDetailClient";

const ALLOWED_STATUS = new Set(["OPEN", "IN_PROGRESS", "DONE"] as const);

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const anonId = await getAnonId();
  const nickname = await getNickname();

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      tasks: { include: { links: true }, orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!idea) {
    notFound();
  }

  const vote = anonId
    ? await prisma.vote.findUnique({ where: { ideaId_anonId: { ideaId: id, anonId } } })
    : null;

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
    viewerAnonId: anonId,
    tasks: idea.tasks.map((t) => {
      const mapped = mapTask(t);
      return {
        ...mapped,
        claimantNickname: mapped.claimedByAnonId ? nicknameByAnonId.get(mapped.claimedByAnonId) ?? "anon" : null,
        status: ALLOWED_STATUS.has(mapped.status as "OPEN" | "IN_PROGRESS" | "DONE")
          ? (mapped.status as "OPEN" | "IN_PROGRESS" | "DONE")
          : "OPEN",
      };
    }),
    comments: idea.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
  };

  return <IdeaDetailClient initialIdea={payload} isVoted={Boolean(vote)} initialNickname={nickname} />;
}
