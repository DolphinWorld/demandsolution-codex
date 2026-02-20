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
  if (task.claimedByAnonId && task.claimedByAnonId !== anonId) {
    return NextResponse.json({ error: "Task already claimed" }, { status: 409 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      claimedByAnonId: anonId,
      claimedAt: new Date(),
      status: task.status === "OPEN" ? "IN_PROGRESS" : task.status,
    },
    include: { links: true },
  });

  const mapped = mapTask(updated);
  const claimant = await prisma.nickname.findUnique({ where: { anonId } });

  return NextResponse.json({
    task: {
      ...mapped,
      claimantNickname: claimant?.nickname ?? "anon",
    },
  });
}
