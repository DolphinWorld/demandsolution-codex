import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapTask } from "@/lib/db-mappers";
import { auth } from "@/auth";
import { getAnonId } from "@/lib/identity";

export async function POST(_: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { taskId } = await params;

  if (!userId && !anonId) return NextResponse.json({ error: "Missing identity" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const allowed = userId ? task.claimedByUserId === userId : !task.claimedByUserId && task.claimedByAnonId === anonId;
  if (!allowed) {
    return NextResponse.json({ error: "Only claimant can unclaim" }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      claimedByUserId: null,
      claimedByAnonId: null,
      claimedAt: null,
      status: "OPEN",
    },
    include: { links: true },
  });

  return NextResponse.json({
    task: {
      ...mapTask(updated),
      claimantNickname: null,
      claimantDisplayName: null,
    },
  });
}
