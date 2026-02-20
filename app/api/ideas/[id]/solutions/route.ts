import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

const schema = z.object({
  taskId: z.string().uuid().optional().or(z.literal("")),
  url: z.string().url().max(500),
  label: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(["APP_URL", "GITHUB_REPO", "OTHER"]).optional(),
});

async function mapSolutions(ideaId: string, userId: string | null, anonId: string | null) {
  const solutions = await prisma.solution.findMany({
    where: { ideaId },
    include: {
      createdByUser: { include: { developerProfile: true } },
      userVotes: true,
      anonVotes: true,
      comments: true,
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return solutions.map((solution) => {
    const userScore = solution.userVotes.reduce((sum, vote) => sum + vote.value, 0);
    const anonScore = solution.anonVotes.reduce((sum, vote) => sum + vote.value, 0);
    const myVote = userId
      ? solution.userVotes.find((vote) => vote.userId === userId)?.value ?? 0
      : solution.anonVotes.find((vote) => vote.anonId === anonId)?.value ?? 0;

    return {
      id: solution.id,
      ideaId: solution.ideaId,
      taskId: solution.taskId,
      taskTitle: solution.task?.title || null,
      url: solution.url,
      label: solution.label,
      description: solution.description,
      type: solution.type,
      createdAt: solution.createdAt,
      approvedAt: solution.approvedAt,
      createdByDisplayName:
        solution.createdByUser.developerProfile?.displayName || solution.createdByUser.name || solution.createdByUser.email || "Developer",
      voteScore: userScore + anonScore,
      myVote,
      commentsCount: solution.comments.length,
    };
  });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { id } = await params;

  return NextResponse.json({ items: await mapSolutions(id, userId, anonId || null) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Developer login required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const taskId = parsed.data.taskId || undefined;
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.ideaId !== id) {
      return NextResponse.json({ error: "Task does not belong to this idea" }, { status: 400 });
    }
  }

  await prisma.solution.create({
    data: {
      ideaId: id,
      taskId: taskId || null,
      createdByUserId: userId,
      url: parsed.data.url,
      label: parsed.data.label,
      description: parsed.data.description,
      type: parsed.data.type || "OTHER",
    },
  });

  const anonId = await getAnonId();
  return NextResponse.json({ items: await mapSolutions(id, userId, anonId || null) }, { status: 201 });
}
