import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify attempt belongs to student and is active
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      status: true,
      serverDeadline: true,
    },
  });

  if (!attempt || attempt.studentId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Attempt is not active" },
      { status: 409 }
    );
  }

  // Check server-side deadline
  if (attempt.serverDeadline && new Date() > attempt.serverDeadline) {
    // Auto-expire
    await expireAttempt(attemptId);
    return NextResponse.json({ error: "Time expired" }, { status: 409 });
  }

  const { questionId, answer } = await req.json();
  if (!questionId) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }

  // Upsert answer
  await prisma.studentAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, answer },
    update: { answer, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

async function expireAttempt(attemptId: string) {
  // Score and close
  const { scoreAttempt } = await import("@/lib/scoring/scoreAttempt");
  await scoreAttempt(attemptId, "TIME_EXPIRED");
}
