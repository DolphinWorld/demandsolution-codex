import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getAnonId } from "@/lib/identity";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { linkId } = await params;

  if (!userId && !anonId) return NextResponse.json({ error: "Missing identity" }, { status: 400 });

  const link = await prisma.taskLink.findUnique({ where: { id: linkId }, include: { task: true } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canDeleteAsUser = Boolean(userId) && (link.createdByUserId === userId || link.task.claimedByUserId === userId);
  const canDeleteAsAnon = Boolean(anonId) && !link.task.claimedByUserId && (link.createdByAnonId === anonId || link.task.claimedByAnonId === anonId);

  if (!canDeleteAsUser && !canDeleteAsAnon) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await prisma.taskLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
