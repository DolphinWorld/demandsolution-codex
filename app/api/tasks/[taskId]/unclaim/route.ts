import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";
import { mapTask } from "@/lib/db-mappers";

export async function POST(_: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const anonId = await getAnonId();
  const { taskId } = await params;

  if (!anonId) return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.claimedByAnonId !== anonId) {
    return NextResponse.json({ error: "Only claimant can unclaim" }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
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
    },
  });
}
