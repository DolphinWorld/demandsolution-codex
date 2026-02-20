import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateSpec } from "@/lib/llm";
import { getAnonId, getClientIp } from "@/lib/identity";
import { mapIdea, mapTask } from "@/lib/db-mappers";
import { scoreHot } from "@/lib/hot-score";
import { auth } from "@/auth";

const createIdeaSchema = z.object({
  raw_input_text: z.string().min(20).max(3000),
  target_users: z.string().max(300).optional(),
  platform: z.enum(["Web", "Mobile", "Desktop", "Any"]).optional(),
  constraints: z.string().max(500).optional(),
  show_name: z.boolean().optional().default(false),
});

const RATE_LIMIT_PER_HOUR = 5;

async function checkRateLimit(rateKey: string, ipAddress: string): Promise<boolean> {
  const now = new Date();
  const windowStart = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;

  const existing = await prisma.submissionRateLimit.findUnique({
    where: {
      anonId_ipAddress_windowStart: { anonId: rateKey, ipAddress, windowStart },
    },
  });

  if (!existing) {
    await prisma.submissionRateLimit.create({
      data: { anonId: rateKey, ipAddress, windowStart, count: 1 },
    });
    return true;
  }

  if (existing.count >= RATE_LIMIT_PER_HOUR) {
    return false;
  }

  await prisma.submissionRateLimit.update({
    where: { id: existing.id },
    data: { count: { increment: 1 } },
  });

  return true;
}

export async function GET(request: NextRequest) {
  const sortParam = request.nextUrl.searchParams.get("sort");
  const sort = sortParam === "new" ? "new" : "hot";
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
  const cursor = request.nextUrl.searchParams.get("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;

  const ideas = await prisma.idea.findMany({
    take: limit + 1,
    where: cursorDate && !Number.isNaN(cursorDate.getTime()) ? { createdAt: { lt: cursorDate } } : undefined,
    include: {
      createdByUser: {
        select: { name: true, developerProfile: { select: { displayName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const hasMore = ideas.length > limit;
  const page = hasMore ? ideas.slice(0, limit) : ideas;

  const mapped = page.map((idea) => {
    const visibleName =
      idea.submitterVisibleName || idea.createdByUser?.developerProfile?.displayName || idea.createdByUser?.name || null;

    return {
      ...mapIdea(idea),
      comment_count: idea.commentsCount,
      submitter_label: idea.isAnonymous ? "Anonymous" : visibleName || "Member",
      is_anonymous: idea.isAnonymous,
    };
  });

  const items =
    sort === "new"
      ? mapped
      : [...mapped].sort((a, b) => scoreHot(b.upvotesCount, b.createdAt) - scoreHot(a.upvotesCount, a.createdAt));

  const nextCursor = hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null;
  return NextResponse.json({ items, nextCursor });
}

export async function POST(request: NextRequest) {
  const anonId = await getAnonId();
  const ipAddress = await getClientIp();
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const rateKey = anonId || (userId ? `user:${userId}` : "");
  if (!rateKey) {
    return NextResponse.json({ error: "Missing identity" }, { status: 400 });
  }

  const allowed = await checkRateLimit(rateKey, ipAddress);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const json = await request.json();
  const parsed = createIdeaSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const spec = await generateSpec(parsed.data);

    let submitterVisibleName: string | null = null;
    const isAnonymous = !(parsed.data.show_name && userId);

    if (!isAnonymous && userId) {
      const profile = await prisma.developerProfile.findUnique({ where: { userId } });
      submitterVisibleName =
        profile?.displayName || session?.user?.name || session?.user?.email || "Member";
    }

    const idea = await prisma.idea.create({
      data: {
        createdByAnonId: anonId || null,
        createdByUserId: userId,
        isAnonymous,
        submitterVisibleName,
        rawInputText: parsed.data.raw_input_text,
        targetUsers: parsed.data.target_users,
        platform: parsed.data.platform,
        constraints: parsed.data.constraints,
        title: spec.title,
        problemStatement: spec.problem_statement,
        tags: JSON.stringify(spec.tags),
        features: JSON.stringify(spec.features),
        openQuestions: JSON.stringify(spec.open_questions),
        tasks: {
          create: spec.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            acceptance: JSON.stringify(task.acceptance_criteria),
            effort: task.effort,
            status: "OPEN",
          })),
        },
      },
      include: { tasks: { include: { links: true } } },
    });

    return NextResponse.json(
      {
        idea: {
          ...mapIdea(idea),
          submitter_label: idea.isAnonymous ? "Anonymous" : submitterVisibleName || "Member",
          tasks: idea.tasks.map((task) => ({
            ...mapTask(task),
            claimantNickname: null,
            claimantDisplayName: null,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate idea spec", detail: String(error) }, { status: 500 });
  }
}
