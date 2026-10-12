import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { StartExamClient } from "./StartExamClient";

export const instant = false;

export default async function StartExamPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const session = await auth();

  // Verify test is assigned and published
  const assignment = await prisma.assignment.findFirst({
    where: { testId, studentId: session!.user.id },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          durationMin: true,
          status: true,
          _count: { select: { passages: true } },
        },
      },
    },
  });

  if (!assignment || assignment.test.status !== "PUBLISHED") {
    notFound();
  }

  // Check for existing active attempt
  const activeAttempt = await prisma.testAttempt.findFirst({
    where: {
      testId,
      studentId: session!.user.id,
      status: "IN_PROGRESS",
    },
  });

  if (activeAttempt) {
    redirect(`/student/tests/${testId}/exam?attemptId=${activeAttempt.id}`);
  }

  const test = assignment.test;

  return (
    <StartExamClient
      testId={test.id}
      testTitle={test.title}
      durationMin={test.durationMin}
      passageCount={test._count.passages}
    />
  );
}
