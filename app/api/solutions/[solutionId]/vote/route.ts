import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

const schema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

async function score(solutionId: string) {
  const userVotes = await prisma.solutionUserVote.findMany({ where: { solutionId }, select: { value: true } });
  const anonVotes = await prisma.solutionAnonVote.findMany({ where: { solutionId }, select: { value: true } });
  return userVotes.reduce((sum, vote) => sum + vote.value, 0) + anonVotes.reduce((sum, vote) => sum + vote.value, 0);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ solutionId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { solutionId } = await params;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (userId) {
    await prisma.solutionUserVote.upsert({
      where: { solutionId_userId: { solutionId, userId } },
      create: { solutionId, userId, value: parsed.data.value },
      update: { value: parsed.data.value },
    });
  } else {
    await prisma.solutionAnonVote.upsert({
      where: { solutionId_anonId: { solutionId, anonId: anonId! } },
      create: { solutionId, anonId: anonId!, value: parsed.data.value },
      update: { value: parsed.data.value },
    });
  }

  return NextResponse.json({ score: await score(solutionId), myVote: parsed.data.value });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ solutionId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { solutionId } = await params;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  if (userId) {
    await prisma.solutionUserVote.deleteMany({ where: { solutionId, userId } });
  } else {
    await prisma.solutionAnonVote.deleteMany({ where: { solutionId, anonId: anonId! } });
  }

  return NextResponse.json({ score: await score(solutionId), myVote: 0 });
}
