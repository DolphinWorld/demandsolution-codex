import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";
import { auth } from "@/auth";

const commentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await prisma.comment.findMany({
    where: { ideaId: id },
    include: {
      createdByUser: {
        include: { developerProfile: { select: { displayName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: comments.map((comment) => ({
      ...comment,
      author_label:
        comment.createdByUser?.developerProfile?.displayName || comment.createdByUser?.name || (comment.createdByUserId ? "Member" : "Anon"),
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { id } = await params;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
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
      createdByUserId: userId,
      createdByAnonId: userId ? null : anonId,
    },
    include: {
      createdByUser: {
        include: { developerProfile: { select: { displayName: true } } },
      },
    },
  });

  await prisma.idea.update({ where: { id }, data: { commentsCount: { increment: 1 } } });
  return NextResponse.json(
    {
      comment: {
        ...comment,
        author_label:
          comment.createdByUser?.developerProfile?.displayName || comment.createdByUser?.name || (comment.createdByUserId ? "Member" : "Anon"),
      },
    },
    { status: 201 }
  );
}
