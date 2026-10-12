import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";

export const instant = false;

const COMPLETED_STATUSES = ["SUBMITTED", "TIME_EXPIRED", "TERMINATED_VIOLATION"] as const;

async function getAnalytics(teacherId: string) {
  const relations = await prisma.teacherStudent.findMany({
    where: { teacherId },
    include: { student: { select: { id: true, name: true } } },
  });
  const studentIds = relations.map((r) => r.student.id);

  const [attempts, answers, activityEvents] = await Promise.all([
    prisma.testAttempt.findMany({
      where: {
        studentId: { in: studentIds },
        test: { teacherId },
        status: { in: [...COMPLETED_STATUSES] },
      },
      include: { test: { select: { title: true } }, student: { select: { id: true, name: true } } },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.studentAnswer.findMany({
      where: { attempt: { studentId: { in: studentIds }, test: { teacherId } } },
      select: {
        isCorrect: true,
        question: { select: { group: { select: { questionType: true } } } },
      },
    }),
    prisma.activityEvent.findMany({
      where: { userId: { in: studentIds } },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 1000,
    }),
  ]);

  const completed = attempts.filter(
    (a) => a.rawScore !== null && a.totalQuestions !== null
  );
  const banded = attempts.filter((a) => a.bandEstimate !== null);

  const avgAccuracy =
    completed.length > 0
      ? Math.round(
          completed.reduce(
            (acc, a) => acc + (a.rawScore! / a.totalQuestions!) * 100,
            0
          ) / completed.length
        )
      : null;

  const avgBand =
    banded.length > 0
      ? banded.reduce((acc, a) => acc + a.bandEstimate!, 0) / banded.length
      : null;

  // Band distribution (0.5 buckets)
  const bandBuckets = new Map<number, number>();
  banded.forEach((a) => {
    const b = a.bandEstimate!;
    bandBuckets.set(b, (bandBuckets.get(b) ?? 0) + 1);
  });
  const bandDistribution = Array.from(bandBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([band, count]) => ({ band, count }));
  const maxBandCount = Math.max(1, ...bandDistribution.map((b) => b.count));

  // Per-question-type accuracy
  const byType: Record<string, { correct: number; total: number }> = {};
  answers.forEach((a) => {
    const t = a.question.group.questionType;
    if (!byType[t]) byType[t] = { correct: 0, total: 0 };
    byType[t].total++;
    if (a.isCorrect) byType[t].correct++;
  });
  const typeBreakdown = Object.entries(byType)
    .map(([type, stats]) => ({
      type,
      pct: Math.round((stats.correct / stats.total) * 100),
      ...stats,
    }))
    .sort((a, b) => b.total - a.total);

  // Per-student summary
  const lastActiveByStudent = new Map<string, Date>();
  const studentAttempts = new Map<string, typeof attempts>();
  attempts.forEach((a) => {
    const arr = studentAttempts.get(a.student.id) ?? [];
    arr.push(a);
    studentAttempts.set(a.student.id, arr);
    if (a.submittedAt) {
      const prev = lastActiveByStudent.get(a.student.id);
      if (!prev || a.submittedAt > prev) lastActiveByStudent.set(a.student.id, a.submittedAt);
    }
  });

  const studentRows = relations.map((r) => {
    const list = studentAttempts.get(r.student.id) ?? [];
    const withScore = list.filter((a) => a.rawScore !== null && a.totalQuestions !== null);
    const withBand = list.filter((a) => a.bandEstimate !== null);
    const accuracy =
      withScore.length > 0
        ? Math.round(
            withScore.reduce((acc, a) => acc + (a.rawScore! / a.totalQuestions!) * 100, 0) /
              withScore.length
          )
        : null;
    const band =
      withBand.length > 0
        ? withBand.reduce((acc, a) => acc + a.bandEstimate!, 0) / withBand.length
        : null;
    return {
      id: r.student.id,
      name: r.student.name,
      attemptCount: list.length,
      accuracy,
      band,
      lastActive: lastActiveByStudent.get(r.student.id) ?? null,
    };
  });
  studentRows.sort((a, b) => (b.band ?? -1) - (a.band ?? -1));

  const dayMap = new Map<string, number>();
  activityEvents.forEach((e) => {
    const d = e.date.toISOString().slice(0, 10);
    dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  });
  const activityData = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

  return {
    totalStudents: relations.length,
    totalAttempts: attempts.length,
    avgAccuracy,
    avgBand,
    bandDistribution,
    maxBandCount,
    typeBreakdown,
    studentRows,
    activityData,
  };
}

export default async function AnalyticsPage() {
  const session = await auth();
  const data = await getAnalytics(session!.user.id);

  return (
    <div className="px-8 py-7 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">Analytics</h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          Performance across all your students and tests
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard label="Students" value={data.totalStudents} accent />
        <StatCard label="Completed Attempts" value={data.totalAttempts} />
        <StatCard
          label="Avg Accuracy"
          value={data.avgAccuracy !== null ? `${data.avgAccuracy}%` : "—"}
        />
        <StatCard
          label="Avg Band"
          value={data.avgBand !== null ? data.avgBand.toFixed(1) : "—"}
          sub="Reading only — not official"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Band distribution */}
        <div className="bg-white border border-[#DCE6DE] rounded-md p-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-4">
            Band distribution
          </h2>
          {data.bandDistribution.length === 0 ? (
            <p className="text-sm text-[#5C6E62]">
              No banded attempts yet. Band estimates only apply to full
              40-question tests.
            </p>
          ) : (
            <div className="space-y-2">
              {data.bandDistribution.map(({ band, count }) => (
                <div key={band} className="flex items-center gap-2">
                  <div className="w-8 text-xs text-[#5C6E62] text-right shrink-0">
                    {band.toFixed(1)}
                  </div>
                  <div className="flex-1 h-4 bg-[#EDF5EF] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#176B4D] rounded-sm transition-all"
                      style={{ width: `${(count / data.maxBandCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-5 text-xs text-[#5C6E62] shrink-0">{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per question type */}
        <div className="bg-white border border-[#DCE6DE] rounded-md p-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-4">
            Accuracy by question type
          </h2>
          {data.typeBreakdown.length === 0 ? (
            <p className="text-sm text-[#5C6E62]">No answered questions yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.typeBreakdown.map((t) => (
                <div key={t.type}>
                  <div className="flex justify-between text-xs text-[#5C6E62] mb-1">
                    <span>{t.type.replace(/_/g, " ")}</span>
                    <span>
                      {t.correct}/{t.total} ({t.pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#EDF5EF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#176B4D] rounded-full transition-all"
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity heatmap */}
      <div className="bg-white border border-[#DCE6DE] rounded-md p-5 mb-5">
        <h2 className="text-sm font-semibold text-[#202923] mb-4">
          Student activity
        </h2>
        {data.activityData.length > 0 ? (
          <ActivityHeatmap data={data.activityData} weeks={20} />
        ) : (
          <p className="text-sm text-[#5C6E62]">No activity recorded yet.</p>
        )}
      </div>

      {/* Per-student table */}
      <div className="bg-white border border-[#DCE6DE] rounded-md">
        <div className="px-5 py-3 border-b border-[#DCE6DE]">
          <h2 className="text-sm font-semibold text-[#202923]">By student</h2>
        </div>
        {data.studentRows.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[#5C6E62] text-center">
            No students yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Student</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Attempts</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Avg Accuracy</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Avg Band</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {data.studentRows.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                >
                  <td className="px-5 py-2.5 text-[#202923]">{s.name}</td>
                  <td className="px-5 py-2.5 text-[#5C6E62]">{s.attemptCount}</td>
                  <td className="px-5 py-2.5 text-[#202923]">
                    {s.accuracy !== null ? `${s.accuracy}%` : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-[#176B4D] font-medium">
                    {s.band !== null ? s.band.toFixed(1) : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-[#5C6E62] text-xs">
                    {s.lastActive
                      ? new Date(s.lastActive).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
