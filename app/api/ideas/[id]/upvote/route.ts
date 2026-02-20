import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const anonId = await getAnonId();
  const { id } = await params;

  if (!anonId) return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });

  try {
    await prisma.vote.create({
      data: { ideaId: id, anonId },
    });
  } catch {
    return NextResponse.json({ ok: true });
  }

  await prisma.idea.update({ where: { id }, data: { upvotesCount: { increment: 1 } } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const anonId = await getAnonId();
  const { id } = await params;

  if (!anonId) return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });

  const existing = await prisma.vote.findUnique({ where: { ideaId_anonId: { ideaId: id, anonId } } });
  if (!existing) return NextResponse.json({ ok: true });

  await prisma.vote.delete({ where: { ideaId_anonId: { ideaId: id, anonId } } });
  await prisma.idea.update({ where: { id }, data: { upvotesCount: { decrement: 1 } } });

  return NextResponse.json({ ok: true });
}
