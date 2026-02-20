import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const anonId = await getAnonId();
  const { linkId } = await params;

  if (!anonId) return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });

  const link = await prisma.taskLink.findUnique({ where: { id: linkId }, include: { task: true } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (link.createdByAnonId !== anonId && link.task.claimedByAnonId !== anonId) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await prisma.taskLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
