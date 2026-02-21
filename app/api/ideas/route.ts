import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateSpec } from "@/lib/llm";
import { getAnonId, getClientIp } from "@/lib/identity";
import { mapIdea, mapTask } from "@/lib/db-mappers";
import { scoreHot } from "@/lib/hot-score";
import { auth } from "@/auth";
import { findBlockedContent } from "@/lib/content-moderation";
import { detectMergeTarget } from "@/lib/idea-dedup";

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

async function applyMergeSupportVote(ideaId: string, userId: string | null, anonId: string | null) {
  if (userId) {
    const existing = await prisma.ideaUserVote.findUnique({ where: { ideaId_userId: { ideaId, userId } } });
    if (existing) return;

    await prisma.ideaUserVote.create({ data: { ideaId, userId } });
    await prisma.idea.update({ where: { id: ideaId }, data: { upvotesCount: { increment: 1 } } });
    return;
  }

  if (anonId) {
    const existing = await prisma.vote.findUnique({ where: { ideaId_anonId: { ideaId, anonId } } });
    if (existing) return;

    await prisma.vote.create({ data: { ideaId, anonId } });
    await prisma.idea.update({ where: { id: ideaId }, data: { upvotesCount: { increment: 1 } } });
  }
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
      workVotes: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              developerProfile: { select: { displayName: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const hasMore = ideas.length > limit;
  const page = hasMore ? ideas.slice(0, limit) : ideas;

  const mapped = page.map((idea) => {
    const visibleName =
      idea.submitterVisibleName || idea.createdByUser?.developerProfile?.displayName || idea.createdByUser?.name || null;

    const workingDevelopers = Array.from(
      new Set(
        idea.workVotes
          .map(
            (vote) =>
              vote.user.developerProfile?.displayName ||
              vote.user.name ||
              vote.user.email?.split("@")[0] ||
              "Developer"
          )
          .filter(Boolean)
      )
    );

    return {
      ...mapIdea(idea),
      comment_count: idea.commentsCount,
      submitter_label: idea.isAnonymous ? "Anonymous" : visibleName || "Member",
      is_anonymous: idea.isAnonymous,
      idea_working_count: workingDevelopers.length,
      working_developers: workingDevelopers,
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

  const moderation = findBlockedContent(parsed.data.raw_input_text, parsed.data.target_users, parsed.data.constraints);
  if (moderation.blocked) {
    return NextResponse.json(
      {
        error: "Submission blocked: obvious offensive or inappropriate language detected. Please revise and submit again.",
        labels: moderation.labels,
      },
      { status: 400 }
    );
  }

  const dedupInput = [parsed.data.raw_input_text, parsed.data.target_users, parsed.data.platform, parsed.data.constraints]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  const candidates = await prisma.idea.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      rawInputText: true,
      title: true,
      problemStatement: true,
    },
  });

  const mergeTarget = detectMergeTarget(
    dedupInput,
    candidates.map((candidate) => ({
      id: candidate.id,
      text: `${candidate.rawInputText}\n${candidate.title}\n${candidate.problemStatement}`,
    }))
  );

  if (mergeTarget) {
    const existing = await prisma.idea.findUnique({ where: { id: mergeTarget.targetIdeaId } });

    if (existing) {
      await prisma.ideaMerge.create({
        data: {
          targetIdeaId: existing.id,
          mergedByAnonId: anonId || null,
          mergedByUserId: userId,
          rawInputText: parsed.data.raw_input_text,
          targetUsers: parsed.data.target_users,
          platform: parsed.data.platform,
          constraints: parsed.data.constraints,
          reason: mergeTarget.reason,
          similarityScore: mergeTarget.similarityScore,
        },
      });

      await applyMergeSupportVote(existing.id, userId, anonId || null);

      return NextResponse.json(
        {
          merged: true,
          reason: mergeTarget.reason,
          message:
            mergeTarget.reason === "SUBSET"
              ? "Your submission is a subset of an existing idea and has been merged into that thread."
              : "Your submission matches an existing idea and has been merged into that thread.",
          idea: {
            id: existing.id,
            title: existing.title,
          },
        },
        { status: 200 }
      );
    }
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
