import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const instant = false;

async function getTeacherStats(teacherId: string) {
  const [
    studentCount,
    publishedTests,
    completedAttempts,
    inProgressAttempts,
    recentActivity,
    activityEvents,
  ] = await Promise.all([
    prisma.teacherStudent.count({ where: { teacherId } }),
    prisma.test.count({ where: { teacherId, status: "PUBLISHED" } }),
    prisma.testAttempt.count({
      where: {
        test: { teacherId },
        status: { in: ["SUBMITTED", "TIME_EXPIRED"] },
      },
    }),
    prisma.testAttempt.count({
      where: { test: { teacherId }, status: "IN_PROGRESS" },
    }),
    prisma.testAttempt.findMany({
      where: {
        test: { teacherId },
        status: { in: ["SUBMITTED", "TIME_EXPIRED", "TERMINATED_VIOLATION"] },
      },
      orderBy: { submittedAt: "desc" },
      take: 8,
      include: { student: { select: { name: true } }, test: { select: { title: true } } },
    }),
    prisma.activityEvent.findMany({
      where: { user: { studentTeachers: { some: { teacherId } } } },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 500,
    }),
  ]);

  // Avg score
  const scores = await prisma.testAttempt.findMany({
    where: {
      test: { teacherId },
      status: { in: ["SUBMITTED", "TIME_EXPIRED"] },
      rawScore: { not: null },
      totalQuestions: { not: null },
    },
    select: { rawScore: true, totalQuestions: true },
  });

  const avgScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((acc, s) => acc + (s.rawScore! / s.totalQuestions!) * 100, 0) /
            scores.length)
        )
      : null;

  // Aggregate activity by day
  const dayMap = new Map<string, number>();
  activityEvents.forEach((e) => {
    const d = e.date.toISOString().slice(0, 10);
    dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  });
  const activityData = Array.from(dayMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    studentCount,
    publishedTests,
    completedAttempts,
    inProgressAttempts,
    avgScore,
    recentActivity,
    activityData,
  };
}

export default async function TeacherDashboard() {
  const session = await auth();
  const stats = await getTeacherStats(session!.user.id);

  return (
    <div className="px-8 py-7 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">Dashboard</h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          Welcome back, {session!.user.name}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard
          label="Students"
          value={stats.studentCount}
          accent
        />
        <StatCard
          label="Published Tests"
          value={stats.publishedTests}
        />
        <StatCard
          label="Completed Attempts"
          value={stats.completedAttempts}
        />
        <StatCard
          label="Avg Score"
          value={stats.avgScore !== null ? `${stats.avgScore}%` : "—"}
          sub="across completed tests"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity heatmap */}
        <div className="lg:col-span-2 bg-white border border-[#DCE6DE] rounded-md p-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-4">
            Student Activity
          </h2>
          {stats.activityData.length > 0 ? (
            <ActivityHeatmap data={stats.activityData} />
          ) : (
            <p className="text-sm text-[#5C6E62]">
              No activity recorded yet. Assign tests to students to begin
              tracking.
            </p>
          )}
        </div>

        {/* In progress */}
        <div className="bg-white border border-[#DCE6DE] rounded-md p-5">
          <h2 className="text-sm font-semibold text-[#202923] mb-3">
            Currently Active
          </h2>
          {stats.inProgressAttempts > 0 ? (
            <div className="text-2xl font-bold text-[#176B4D]">
              {stats.inProgressAttempts}
              <span className="text-sm font-normal text-[#5C6E62] ml-1">
                attempt{stats.inProgressAttempts !== 1 ? "s" : ""} in progress
              </span>
            </div>
          ) : (
            <p className="text-sm text-[#5C6E62]">No active tests right now.</p>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-5 bg-white border border-[#DCE6DE] rounded-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#DCE6DE]">
          <h2 className="text-sm font-semibold text-[#202923]">
            Recent Submissions
          </h2>
          <Link
            href="/teacher/students"
            className="text-xs text-[#176B4D] hover:underline"
          >
            View all students
          </Link>
        </div>
        {stats.recentActivity.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[#5C6E62] text-center">
            No submissions yet.{" "}
            <Link href="/teacher/tests" className="text-[#176B4D] hover:underline">
              Create and assign a test
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Student</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Test</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Score</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Status</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">When</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentActivity.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                >
                  <td className="px-5 py-2.5 text-[#202923]">
                    {attempt.student.name}
                  </td>
                  <td className="px-5 py-2.5 text-[#5C6E62] max-w-[200px] truncate">
                    {attempt.test.title}
                  </td>
                  <td className="px-5 py-2.5 text-[#202923]">
                    {attempt.rawScore !== null && attempt.totalQuestions !== null
                      ? `${attempt.rawScore}/${attempt.totalQuestions}`
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <AttemptStatusBadge status={attempt.status} />
                  </td>
                  <td className="px-5 py-2.5 text-[#5C6E62] text-xs">
                    {attempt.submittedAt
                      ? formatDistanceToNow(attempt.submittedAt, {
                          addSuffix: true,
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

function AttemptStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUBMITTED: { label: "Submitted", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    TIME_EXPIRED: { label: "Expired", cls: "bg-[#FFF6E0] text-[#B08000]" },
    TERMINATED_VIOLATION: {
      label: "Violation",
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
