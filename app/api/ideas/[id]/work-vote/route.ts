import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function responseFor(ideaId: string, userId: string) {
  const count = await prisma.ideaWorkVote.count({ where: { ideaId } });
  const mine = await prisma.ideaWorkVote.findUnique({ where: { ideaId_userId: { ideaId, userId } } });
  return { working_count: count, working: Boolean(mine) };
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  if (!userId) return NextResponse.json({ error: "Developer login required" }, { status: 401 });

  await prisma.ideaWorkVote.upsert({
    where: { ideaId_userId: { ideaId: id, userId } },
    create: { ideaId: id, userId },
    update: {},
  });

  return NextResponse.json(await responseFor(id, userId));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  if (!userId) return NextResponse.json({ error: "Developer login required" }, { status: 401 });

  await prisma.ideaWorkVote.deleteMany({ where: { ideaId: id, userId } });
  return NextResponse.json(await responseFor(id, userId));
}
