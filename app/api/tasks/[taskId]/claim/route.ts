import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";
import { mapTask } from "@/lib/db-mappers";
import { auth } from "@/auth";

export async function POST(_: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { taskId } = await params;

  if (!userId && !anonId) return NextResponse.json({ error: "Missing identity" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const claimedByOtherUser = task.claimedByUserId && task.claimedByUserId !== userId;
  const claimedByOtherAnon = !task.claimedByUserId && task.claimedByAnonId && task.claimedByAnonId !== anonId;
  if (claimedByOtherUser || claimedByOtherAnon) {
    return NextResponse.json({ error: "Task already claimed" }, { status: 409 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      claimedByUserId: userId,
      claimedByAnonId: userId ? null : anonId,
      claimedAt: new Date(),
      status: task.status === "OPEN" ? "IN_PROGRESS" : task.status,
    },
    include: { links: true },
  });

  const claimantNickname = userId
    ? (
        await prisma.developerProfile.findUnique({ where: { userId }, include: { user: true } })
      )?.displayName || session?.user?.name || "Member"
    : (await prisma.nickname.findUnique({ where: { anonId: anonId! } }))?.nickname || "anon";

  return NextResponse.json({
    task: {
      ...mapTask(updated),
      claimantNickname,
      claimantDisplayName: claimantNickname,
    },
  });
}
