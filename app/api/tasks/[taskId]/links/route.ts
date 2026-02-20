import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

const schema = z.object({
  url: z.string().url(),
  label: z.string().max(100).optional(),
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

  if (task.claimedByAnonId !== anonId) {
    return NextResponse.json({ error: "Only claimant can add links" }, { status: 403 });
  }

  const link = await prisma.taskLink.create({
    data: {
      taskId,
      url: parsed.data.url,
      label: parsed.data.label,
      createdByAnonId: anonId,
    },
  });

  return NextResponse.json({ link }, { status: 201 });
}
