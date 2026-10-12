import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const instant = false;

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ attemptId?: string; terminated?: string }>;
}) {
  const { testId } = await params;
  const { attemptId, terminated } = await searchParams;
  const session = await auth();

  const attempt = await prisma.testAttempt.findFirst({
    where: {
      id: attemptId,
      testId,
      studentId: session!.user.id,
    },
    include: {
      test: { select: { title: true, durationMin: true } },
      violation: { select: { type: true, occurredAt: true } },
      answers: {
        include: {
          question: {
            include: {
              group: { select: { questionType: true, passageId: true } },
            },
          },
        },
        orderBy: { question: { number: "asc" } },
      },
    },
  });

  if (!attempt) notFound();

  const isViolation = attempt.status === "TERMINATED_VIOLATION";
  const isExpired = attempt.status === "TIME_EXPIRED";

  const timeTaken =
    attempt.startedAt && attempt.submittedAt
      ? Math.floor(
          (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000
        )
      : null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // Performance by question type
  const byType: Record<string, { correct: number; total: number }> = {};
  attempt.answers.forEach((a) => {
    const t = a.question.group.questionType;
    if (!byType[t]) byType[t] = { correct: 0, total: 0 };
    byType[t].total++;
    if (a.isCorrect) byType[t].correct++;
  });

  const accuracy =
    attempt.totalQuestions && attempt.totalQuestions > 0
      ? Math.round(((attempt.rawScore ?? 0) / attempt.totalQuestions) * 100)
      : 0;

  return (
    <div className="px-8 py-7 max-w-3xl">
      {/* Header */}
      {isViolation && (
        <div className="mb-5 bg-[#F5E5E5] border border-[#B84242]/20 rounded-md px-5 py-4">
          <div className="font-semibold text-[#B84242] mb-1">
            Test terminated — Tab Switch Violation
          </div>
          <p className="text-sm text-[#B84242]/80">
            Your attempt was automatically ended because you switched away from
            the exam tab. The score below reflects only the answers you
            submitted before the violation.
          </p>
        </div>
      )}
      {isExpired && (
        <div className="mb-5 bg-[#FFF6E0] border border-[#E8B84B]/30 rounded-md px-5 py-4">
          <div className="font-semibold text-[#B08000]">Time expired</div>
          <p className="text-sm text-[#B08000]/80">
            Your attempt was automatically submitted when time ran out.
          </p>
        </div>
      )}
      {terminated === "1" && !isViolation && (
        <div className="mb-5 bg-[#F5E5E5] border border-[#B84242]/20 rounded-md px-5 py-3">
          <p className="text-sm text-[#B84242]">Attempt ended due to tab switch.</p>
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-lg font-semibold text-[#202923]">
          {attempt.test.title}
        </h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          {timeTaken !== null ? `Completed in ${formatTime(timeTaken)}` : ""}
        </p>
      </div>

      {/* Score card */}
      <div className="bg-white border border-[#DCE6DE] rounded-md p-6 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
          <div>
            <div className="text-3xl font-bold text-[#176B4D]">
              {attempt.rawScore ?? 0}
              <span className="text-lg text-[#5C6E62]">
                /{attempt.totalQuestions ?? 0}
              </span>
            </div>
            <div className="text-xs text-[#5C6E62] mt-1">Raw score</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#202923]">{accuracy}%</div>
            <div className="text-xs text-[#5C6E62] mt-1">Accuracy</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#202923]">
              {attempt.bandEstimate !== null && attempt.bandEstimate !== undefined
                ? attempt.bandEstimate.toFixed(1)
                : "—"}
            </div>
            <div className="text-xs text-[#5C6E62] mt-1">Est. band</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#202923]">
              {attempt.unansweredCount ?? 0}
            </div>
            <div className="text-xs text-[#5C6E62] mt-1">Unanswered</div>
          </div>
        </div>
        {attempt.bandEstimate !== null && attempt.bandEstimate !== undefined && (
          <p className="text-xs text-[#9CB0A3] mt-4 text-center">
            Band estimate is for practice purposes only and does not represent
            an official IELTS score.
          </p>
        )}
      </div>

      {/* By question type */}
      {Object.keys(byType).length > 0 && (
        <div className="bg-white border border-[#DCE6DE] rounded-md p-5 mb-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-4">
            Performance by question type
          </h2>
          <div className="space-y-2.5">
            {Object.entries(byType).map(([type, stats]) => {
              const pct = Math.round((stats.correct / stats.total) * 100);
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs text-[#5C6E62] mb-1">
                    <span>{type.replace(/_/g, " ")}</span>
                    <span>
                      {stats.correct}/{stats.total} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#EDF5EF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#176B4D] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href="/student"
          className="text-sm border border-[#DCE6DE] text-[#202923] px-4 py-2 rounded hover:bg-[#EDF5EF] transition-colors"
        >
          Back to dashboard
        </Link>
        <Link
          href="/student/tests"
          className="text-sm text-[#176B4D] hover:underline px-4 py-2"
        >
          View assigned tests
        </Link>
      </div>
    </div>
  );
}
