import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapTask } from "@/lib/db-mappers";
import { auth } from "@/auth";
import { getAnonId } from "@/lib/identity";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { taskId } = await params;

  if (!userId && !anonId) return NextResponse.json({ error: "Missing identity" }, { status: 400 });

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const allowed = userId
    ? !task.claimedByUserId || task.claimedByUserId === userId
    : !task.claimedByUserId && (!task.claimedByAnonId || task.claimedByAnonId === anonId);

  if (!allowed) {
    return NextResponse.json({ error: "Only claimant can change status" }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: parsed.data.status,
      claimedByUserId: task.claimedByUserId ?? userId,
      claimedByAnonId: task.claimedByUserId ? null : task.claimedByAnonId ?? (userId ? null : anonId),
      claimedAt: task.claimedAt ?? new Date(),
    },
    include: { links: true },
  });

  let claimantDisplayName: string | null = null;
  if (updated.claimedByUserId) {
    const profile = await prisma.developerProfile.findUnique({
      where: { userId: updated.claimedByUserId },
      include: { user: true },
    });
    claimantDisplayName = profile?.displayName || profile?.user.name || "Member";
  } else if (updated.claimedByAnonId) {
    claimantDisplayName = (await prisma.nickname.findUnique({ where: { anonId: updated.claimedByAnonId } }))?.nickname || "anon";
  }

  return NextResponse.json({
    task: {
      ...mapTask(updated),
      claimantNickname: claimantDisplayName,
      claimantDisplayName,
    },
  });
}
