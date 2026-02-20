import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function responseFor(taskId: string, userId: string) {
  const count = await prisma.taskWorkVote.count({ where: { taskId } });
  const mine = await prisma.taskWorkVote.findUnique({ where: { taskId_userId: { taskId, userId } } });
  return { working_count: count, working: Boolean(mine) };
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  const { taskId } = await params;

  if (!userId) return NextResponse.json({ error: "Developer login required" }, { status: 401 });

  await prisma.taskWorkVote.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId },
    update: {},
  });

  return NextResponse.json(await responseFor(taskId, userId));
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  const { taskId } = await params;

  if (!userId) return NextResponse.json({ error: "Developer login required" }, { status: 401 });

  await prisma.taskWorkVote.deleteMany({ where: { taskId, userId } });
  return NextResponse.json(await responseFor(taskId, userId));
}
