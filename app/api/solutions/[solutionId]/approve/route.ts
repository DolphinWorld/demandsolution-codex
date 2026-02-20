import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnonId } from "@/lib/identity";

export async function POST(_: NextRequest, { params }: { params: Promise<{ solutionId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getAnonId();
  const { solutionId } = await params;

  const solution = await prisma.solution.findUnique({
    where: { id: solutionId },
    include: { idea: true },
  });

  if (!solution) {
    return NextResponse.json({ error: "Solution not found" }, { status: 404 });
  }

  const canApproveByUser = Boolean(userId) && solution.idea.createdByUserId === userId;
  const canApproveByAnon = Boolean(anonId) && !solution.idea.createdByUserId && solution.idea.createdByAnonId === anonId;

  if (!canApproveByUser && !canApproveByAnon) {
    return NextResponse.json({ error: "Only idea submitter can approve" }, { status: 403 });
  }

  const updated = await prisma.solution.update({
    where: { id: solutionId },
    data: {
      approvedAt: new Date(),
      approvedBySubmitterUserId: userId,
      approvedBySubmitterAnonId: userId ? null : anonId,
    },
  });

  return NextResponse.json({ solution: updated });
}
