import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import Link from "next/link";

async function getStudentStats(studentId: string) {
  const [assignments, attempts, activityEvents] = await Promise.all([
    prisma.assignment.findMany({
      where: { studentId },
      include: { test: { select: { id: true, title: true, durationMin: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testAttempt.findMany({
      where: {
        studentId,
        status: { in: ["SUBMITTED", "TIME_EXPIRED", "TERMINATED_VIOLATION"] },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: { test: { select: { title: true } } },
    }),
    prisma.activityEvent.findMany({
      where: { userId: studentId },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  const completedAttempts = attempts.filter(
    (a) => a.status === "SUBMITTED" || a.status === "TIME_EXPIRED"
  );

  const avgScore =
    completedAttempts.length > 0 && completedAttempts[0].rawScore !== null
      ? Math.round(
          completedAttempts
            .filter((a) => a.rawScore !== null && a.totalQuestions !== null)
            .reduce(
              (acc, a) => acc + (a.rawScore! / a.totalQuestions!) * 100,
              0
            ) / completedAttempts.filter((a) => a.rawScore !== null).length
        )
      : null;

  const latestBand = completedAttempts.find((a) => a.bandEstimate !== null)?.bandEstimate ?? null;

  const dayMap = new Map<string, number>();
  activityEvents.forEach((e) => {
    const d = e.date.toISOString().slice(0, 10);
    dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  });
  const activityData = Array.from(dayMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // Active assignments (no completed attempt)
  const completedTestIds = new Set(attempts.map((a) => a.test.title));
  const pendingAssignments = assignments.filter(
    (asgn) => !completedTestIds.has(asgn.test.title)
  );

  return {
    assignments,
    pendingAssignments,
    attempts,
    avgScore,
    latestBand,
    activityData,
    totalCompleted: completedAttempts.length,
  };
}

export default async function StudentDashboard() {
  const session = await auth();
  const stats = await getStudentStats(session!.user.id);

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">
          Welcome, {session!.user.name}
        </h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          Track your IELTS Reading progress
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard
          label="Tests Completed"
          value={stats.totalCompleted}
          accent
        />
        <StatCard
          label="Avg Score"
          value={stats.avgScore !== null ? `${stats.avgScore}%` : "—"}
        />
        <StatCard
          label="Est. Reading Band"
          value={stats.latestBand !== null ? stats.latestBand.toFixed(1) : "—"}
          sub="Reading only — not official"
        />
        <StatCard
          label="Assigned Tests"
          value={stats.pendingAssignments.length}
          sub="pending"
        />
      </div>

      {/* Main CTA + assigned tests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white border border-[#DCE6DE] rounded-md p-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-3">
            Assigned Tests
          </h2>
          {stats.pendingAssignments.length === 0 ? (
            <p className="text-sm text-[#5C6E62]">
              No tests assigned right now. Check back later.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.pendingAssignments.slice(0, 5).map((asgn) => (
                <div
                  key={asgn.id}
                  className="flex items-center justify-between border border-[#DCE6DE] rounded px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-[#202923]">
                      {asgn.test.title}
                    </div>
                    <div className="text-xs text-[#5C6E62] mt-0.5">
                      {asgn.test.durationMin} min · Reading
                    </div>
                  </div>
                  <Link
                    href={`/student/tests/${asgn.test.id}/start`}
                    className="text-sm bg-[#176B4D] hover:bg-[#123D30] text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Start
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity heatmap */}
        <div className="bg-white border border-[#DCE6DE] rounded-md p-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-3">
            Practice Activity
          </h2>
          <ActivityHeatmap data={stats.activityData} weeks={16} />
        </div>
      </div>

      {/* IELTS Skills overview */}
      <div className="bg-white border border-[#DCE6DE] rounded-md p-5 mb-5">
        <h2 className="text-sm font-semibold text-[#202923] mb-3">
          IELTS Skills Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { skill: "Reading", active: true, band: stats.latestBand },
            { skill: "Listening", active: false },
            { skill: "Writing", active: false },
            { skill: "Speaking", active: false },
          ].map(({ skill, active, band }) => (
            <div
              key={skill}
              className="border border-[#DCE6DE] rounded px-4 py-3"
            >
              <div className="text-xs font-medium text-[#5C6E62] mb-1">
                {skill}
              </div>
              {active ? (
                <div className="text-lg font-bold text-[#176B4D]">
                  {band !== null && band !== undefined ? band.toFixed(1) : "—"}
                </div>
              ) : (
                <div className="text-xs text-[#9CB0A3] italic">Coming soon</div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#9CB0A3] mt-3">
          Band estimates are for practice purposes and do not represent official
          IELTS scores.
        </p>
      </div>

      {/* Recent results */}
      {stats.attempts.length > 0 && (
        <div className="bg-white border border-[#DCE6DE] rounded-md">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#DCE6DE]">
            <h2 className="text-sm font-semibold text-[#202923]">
              Recent Results
            </h2>
            <Link
              href="/student/results"
              className="text-xs text-[#176B4D] hover:underline"
            >
              View all
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Test</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Score</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Band</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.attempts.slice(0, 5).map((attempt) => (
                <tr
                  key={attempt.id}
                  className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                >
                  <td className="px-5 py-2.5 text-[#202923] max-w-[200px] truncate">
                    {attempt.test.title}
                  </td>
                  <td className="px-5 py-2.5 text-[#202923]">
                    {attempt.rawScore !== null && attempt.totalQuestions !== null
                      ? `${attempt.rawScore}/${attempt.totalQuestions}`
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-[#176B4D] font-medium">
                    {attempt.bandEstimate !== null
                      ? attempt.bandEstimate!.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={attempt.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUBMITTED: { label: "Completed", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    TIME_EXPIRED: { label: "Time up", cls: "bg-[#FFF6E0] text-[#B08000]" },
    TERMINATED_VIOLATION: {
      label: "Terminated",
      cls: "bg-[#F5E5E5] text-[#B84242]",
    },
  };
  const info = map[status] ?? { label: status, cls: "bg-[#EDF5EF] text-[#5C6E62]" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${info.cls}`}>
      {info.label}
    </span>
  );
}
