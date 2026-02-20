import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";
import { auth } from "@/auth";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { id } = await params;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  if (userId) {
    const existing = await prisma.ideaUserVote.findUnique({ where: { ideaId_userId: { ideaId: id, userId } } });
    if (existing) return NextResponse.json({ ok: true });

    await prisma.ideaUserVote.create({ data: { ideaId: id, userId } });
    await prisma.idea.update({ where: { id }, data: { upvotesCount: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }

  const existing = await prisma.vote.findUnique({ where: { ideaId_anonId: { ideaId: id, anonId: anonId! } } });
  if (existing) return NextResponse.json({ ok: true });

  await prisma.vote.create({ data: { ideaId: id, anonId: anonId! } });
  await prisma.idea.update({ where: { id }, data: { upvotesCount: { increment: 1 } } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { id } = await params;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  if (userId) {
    const existing = await prisma.ideaUserVote.findUnique({ where: { ideaId_userId: { ideaId: id, userId } } });
    if (!existing) return NextResponse.json({ ok: true });

    await prisma.ideaUserVote.delete({ where: { ideaId_userId: { ideaId: id, userId } } });
    await prisma.idea.update({ where: { id }, data: { upvotesCount: { decrement: 1 } } });
    return NextResponse.json({ ok: true });
  }

  const existing = await prisma.vote.findUnique({ where: { ideaId_anonId: { ideaId: id, anonId: anonId! } } });
  if (!existing) return NextResponse.json({ ok: true });

  await prisma.vote.delete({ where: { ideaId_anonId: { ideaId: id, anonId: anonId! } } });
  await prisma.idea.update({ where: { id }, data: { upvotesCount: { decrement: 1 } } });
  return NextResponse.json({ ok: true });
}
