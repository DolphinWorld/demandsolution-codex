import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapIdea, mapTask } from "@/lib/db-mappers";
import { getAnonId } from "@/lib/identity";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const anonId = await getAnonId();
  const { id } = await params;

  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      tasks: { include: { links: true }, orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "desc" } },
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

  return NextResponse.json({
    idea: {
      ...mapIdea(idea),
      viewerAnonId: anonId,
      tasks: idea.tasks.map((task) => {
        const mapped = mapTask(task);
        return {
          ...mapped,
          claimantNickname: mapped.claimedByAnonId ? nicknameByAnonId.get(mapped.claimedByAnonId) ?? "anon" : null,
        };
      }),
      comments: idea.comments,
    },
  });
}
