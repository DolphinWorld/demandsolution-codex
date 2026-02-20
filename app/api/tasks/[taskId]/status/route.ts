import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";
import { mapTask } from "@/lib/db-mappers";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const anonId = await getAnonId();
  const { taskId } = await params;

  if (!anonId) return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (task.claimedByAnonId && task.claimedByAnonId !== anonId) {
    return NextResponse.json({ error: "Only claimant can change status" }, { status: 403 });
  }

  const nextClaimedBy = task.claimedByAnonId ?? anonId;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: parsed.data.status,
      claimedByAnonId: nextClaimedBy,
      claimedAt: task.claimedAt ?? new Date(),
    },
    include: { links: true },
  });

  const claimant = await prisma.nickname.findUnique({ where: { anonId: nextClaimedBy } });

  return NextResponse.json({
    task: {
      ...mapTask(updated),
      claimantNickname: claimant?.nickname ?? "anon",
    },
  });
}
