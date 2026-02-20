import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

const schema = z.object({
  nickname: z.string().min(2).max(24),
});

export async function POST(request: NextRequest) {
  const anonId = await getAnonId();
  if (!anonId) return NextResponse.json({ error: "Missing anon identity" }, { status: 400 });

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nickname = parsed.data.nickname.trim();

  await prisma.nickname.upsert({
    where: { anonId },
    create: { anonId, nickname },
    update: { nickname },
  });

  const res = NextResponse.json({ ok: true, nickname });
  res.cookies.set("nickname", nickname, {
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
