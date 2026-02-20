import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const schema = z.object({
  displayName: z.string().min(2).max(50),
  headline: z.string().max(120).optional(),
  bio: z.string().max(500).optional(),
  githubUrl: z.string().url().max(200).optional().or(z.literal("")),
  websiteUrl: z.string().url().max(200).optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const profile = await prisma.developerProfile.findUnique({ where: { userId } });
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await prisma.developerProfile.upsert({
    where: { userId },
    create: {
      userId,
      displayName: parsed.data.displayName.trim(),
      headline: parsed.data.headline?.trim() || null,
      bio: parsed.data.bio?.trim() || null,
      githubUrl: parsed.data.githubUrl?.trim() || null,
      websiteUrl: parsed.data.websiteUrl?.trim() || null,
    },
    update: {
      displayName: parsed.data.displayName.trim(),
      headline: parsed.data.headline?.trim() || null,
      bio: parsed.data.bio?.trim() || null,
      githubUrl: parsed.data.githubUrl?.trim() || null,
      websiteUrl: parsed.data.websiteUrl?.trim() || null,
    },
  });

  return NextResponse.json({ profile });
}
