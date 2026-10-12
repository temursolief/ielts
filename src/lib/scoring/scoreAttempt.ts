import { prisma } from "@/lib/prisma";
import { evaluateAnswer } from "./answerEvaluation";
import { estimateBand } from "./bandConversion";
import type { AttemptStatus } from "@prisma/client";

export async function scoreAttempt(
  attemptId: string,
  finalStatus: AttemptStatus
) {
  // Load attempt + all answers + answer keys in one query
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              answerKey: true,
              group: { select: { questionType: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "IN_PROGRESS") {
    // Idempotent — already scored
    return attempt;
  }

  let correct = 0;
  let incorrect = 0;

  const answerUpdates: Promise<unknown>[] = [];

  for (const sa of attempt.answers) {
    const key = sa.question.answerKey;
    if (!key) continue;

    const result = evaluateAnswer({
      questionType: sa.question.group.questionType,
      studentAnswer: sa.answer,
      acceptedAnswers: key.acceptedAnswers as string[],
      caseSensitive: key.caseSensitive,
      wordLimit: sa.question.wordLimit,
    });

    if (result.correct) {
      correct++;
    } else {
      incorrect++;
    }

    answerUpdates.push(
      prisma.studentAnswer.update({
        where: { id: sa.id },
        data: { isCorrect: result.correct },
      })
    );
  }

  await Promise.all(answerUpdates);

  const totalQuestions = attempt.totalQuestions ?? 0;
  const answered = attempt.answers.length;
  const unanswered = totalQuestions - answered;
  const band = estimateBand(correct, totalQuestions);

  const updated = await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: finalStatus,
      submittedAt: new Date(),
      rawScore: correct,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered < 0 ? 0 : unanswered,
      bandEstimate: band,
    },
  });

  // Log activity event for student
  await prisma.activityEvent.create({
    data: {
      userId: attempt.studentId,
      type: "ATTEMPT_COMPLETED",
      metadata: {
        attemptId,
        testId: attempt.testId,
        rawScore: correct,
        totalQuestions,
        status: finalStatus,
      },
    },
  });

  return updated;
}
