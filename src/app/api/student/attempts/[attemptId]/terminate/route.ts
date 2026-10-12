import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreAttempt } from "@/lib/scoring/scoreAttempt";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { studentId: true, status: true, testId: true },
  });

  if (!attempt || attempt.studentId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (attempt.status !== "IN_PROGRESS") {
    // Idempotent
    return NextResponse.json({ ok: true });
  }

  const { type = "TAB_SWITCH", details } = (await req.json().catch(() => ({}))) as {
    type?: string;
    details?: unknown;
  };

  // Score with partial answers then mark terminated
  await scoreAttempt(attemptId, "TERMINATED_VIOLATION");

  // Record violation
  await prisma.attemptViolation.create({
    data: {
      attemptId,
      type,
      details: details ? (details as object) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
