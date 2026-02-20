import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

const schema = z.object({
  body: z.string().min(1).max(1000),
});

async function listComments(solutionId: string) {
  const comments = await prisma.solutionComment.findMany({
    where: { solutionId },
    include: {
      createdByUser: {
        include: {
          developerProfile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return comments.map((comment) => ({
    ...comment,
    author_label:
      comment.createdByUser?.developerProfile?.displayName || comment.createdByUser?.name || (comment.createdByUserId ? "Member" : "Anon"),
  }));
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ solutionId: string }> }) {
  const { solutionId } = await params;
  return NextResponse.json({ items: await listComments(solutionId) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ solutionId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { solutionId } = await params;

  if (!userId && !anonId) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.solutionComment.create({
    data: {
      solutionId,
      body: parsed.data.body,
      createdByUserId: userId,
      createdByAnonId: userId ? null : anonId,
    },
  });

  return NextResponse.json({ items: await listComments(solutionId) }, { status: 201 });
}
