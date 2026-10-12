import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TestManageClient } from "./TestManageClient";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const session = await auth();

  const test = await prisma.test.findFirst({
    where: { id: testId, teacherId: session!.user.id },
    include: {
      passages: {
        orderBy: { order: "asc" },
        include: {
          questionGroups: {
            include: { questions: { orderBy: { number: "asc" } } },
          },
        },
      },
      assignments: {
        include: { student: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
      attempts: {
        include: { student: { select: { name: true } } },
        orderBy: { startedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!test) notFound();

  // Get students not yet assigned
  const assignedIds = new Set(test.assignments.map((a) => a.studentId));
  const students = await prisma.teacherStudent.findMany({
    where: { teacherId: session!.user.id },
    include: { student: { select: { id: true, name: true, email: true } } },
  });
  const unassignedStudents = students
    .map((ts) => ts.student)
    .filter((s) => !assignedIds.has(s.id));

  const totalQ = test.passages.reduce(
    (acc, p) =>
      acc +
      p.questionGroups.reduce((a, g) => a + g.questions.length, 0),
    0
  );

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/teacher/tests"
          className="text-sm text-[#5C6E62] hover:text-[#202923]"
        >
          ← Tests
        </Link>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#202923]">{test.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-[#5C6E62]">
            <span>{test.durationMin} min</span>
            <span>·</span>
            <span>{test.passages.length} passages</span>
            <span>·</span>
            <span>{totalQ} questions</span>
          </div>
        </div>
        <TestStatusBadge status={test.status} />
      </div>

      <TestManageClient
        testId={testId}
        status={test.status}
        test={test}
        unassignedStudents={unassignedStudents}
      />
    </div>
  );
}

function TestStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-[#F0F0F0] text-[#666]" },
    PUBLISHED: { label: "Published", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    ARCHIVED: { label: "Archived", cls: "bg-[#FFF6E0] text-[#B08000]" },
  };
  const info = map[status] ?? { label: status, cls: "bg-[#EDF5EF] text-[#5C6E62]" };
  return (
    <span className={`text-xs px-3 py-1 rounded ${info.cls} font-medium`}>
      {info.label}
    </span>
  );
}
