import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studentId } = await req.json();
  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }

  // Verify teacher-student relationship
  const rel = await prisma.teacherStudent.findUnique({
    where: {
      teacherId_studentId: {
        teacherId: session.user.id,
        studentId,
      },
    },
  });
  if (!rel) {
    return NextResponse.json({ error: "Student not in your roster" }, { status: 403 });
  }

  // Verify test belongs to teacher
  const test = await prisma.test.findFirst({
    where: { id: testId, teacherId: session.user.id },
  });
  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upsert assignment
  await prisma.assignment.upsert({
    where: {
      // No unique constraint on testId+studentId yet — check and create
      id: "noop",
    },
    create: {
      testId,
      teacherId: session.user.id,
      studentId,
    },
    update: {},
  }).catch(async () => {
    // Fallback: check if already exists
    const existing = await prisma.assignment.findFirst({
      where: { testId, studentId },
    });
    if (!existing) {
      await prisma.assignment.create({
        data: { testId, teacherId: session.user.id, studentId },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
