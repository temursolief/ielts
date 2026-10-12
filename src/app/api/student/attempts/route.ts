import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { testId } = await req.json();
  if (!testId) {
    return NextResponse.json({ error: "testId required" }, { status: 400 });
  }

  // Verify assignment
  const assignment = await prisma.assignment.findFirst({
    where: { testId, studentId: session.user.id },
    include: { test: { select: { durationMin: true, status: true } } },
  });

  if (!assignment || assignment.test.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Test not available" }, { status: 403 });
  }

  // Check for existing active attempt
  const existing = await prisma.testAttempt.findFirst({
    where: { testId, studentId: session.user.id, status: "IN_PROGRESS" },
  });
  if (existing) {
    return NextResponse.json({ id: existing.id });
  }

  // Count questions
  const questionCount = await prisma.question.count({
    where: { group: { passage: { testId } } },
  });

  const durationSec = assignment.test.durationMin * 60;
  const now = new Date();
  const deadline = new Date(now.getTime() + durationSec * 1000);

  const attempt = await prisma.testAttempt.create({
    data: {
      testId,
      studentId: session.user.id,
      status: "IN_PROGRESS",
      startedAt: now,
      timeLimitSec: durationSec,
      serverDeadline: deadline,
      totalQuestions: questionCount,
    },
  });

  return NextResponse.json({ id: attempt.id }, { status: 201 });
}
