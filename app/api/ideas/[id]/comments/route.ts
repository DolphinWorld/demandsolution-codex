import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

const commentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await prisma.comment.findMany({ where: { ideaId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items: comments });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const anonId = await getAnonId();
  const { id } = await params;

  if (!anonId) {
    return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });
  }

  const json = await request.json();
  const parsed = commentSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      ideaId: id,
      body: parsed.data.body,
      createdByAnonId: anonId,
    },
  });

  await prisma.idea.update({ where: { id }, data: { commentsCount: { increment: 1 } } });
  return NextResponse.json({ comment }, { status: 201 });
}
