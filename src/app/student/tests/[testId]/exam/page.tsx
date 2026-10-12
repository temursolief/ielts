import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ExamClient } from "@/components/exam/ExamClient";

export const instant = false;

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { testId } = await params;
  const { attemptId } = await searchParams;
  const session = await auth();

  if (!attemptId) redirect(`/student/tests/${testId}/start`);

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      status: true,
      serverDeadline: true,
      testId: true,
    },
  });

  if (!attempt || attempt.studentId !== session!.user.id) {
    notFound();
  }

  if (attempt.status !== "IN_PROGRESS") {
    redirect(`/student/tests/${testId}/results?attemptId=${attemptId}`);
  }

  // Load full test structure (without answer keys)
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      passages: {
        orderBy: { order: "asc" },
        include: {
          questionGroups: {
            orderBy: { order: "asc" },
            include: {
              questions: {
                orderBy: { number: "asc" },
                select: {
                  id: true,
                  number: true,
                  stem: true,
                  options: true,
                  wordLimit: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!test) notFound();

  // Load existing answers
  const savedAnswers = await prisma.studentAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, answer: true },
  });

  const answersMap: Record<string, unknown> = {};
  savedAnswers.forEach((a) => {
    answersMap[a.questionId] = a.answer;
  });

  return (
    <ExamClient
      attempt={{
        id: attempt.id,
        serverDeadline: attempt.serverDeadline?.toISOString() ?? null,
      }}
      test={{
        id: test.id,
        title: test.title,
        passages: test.passages.map((p) => ({
          id: p.id,
          order: p.order,
          title: p.title,
          body: p.body,
          questionGroups: p.questionGroups.map((g) => ({
            id: g.id,
            questionType: g.questionType,
            instructions: g.instructions,
            options: g.options as string[] | null,
            questions: g.questions.map((q) => ({
              id: q.id,
              number: q.number,
              stem: q.stem,
              options: q.options as string[] | null,
              wordLimit: q.wordLimit,
            })),
          })),
        })),
      }}
      initialAnswers={answersMap}
    />
  );
}
