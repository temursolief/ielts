import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";

export const instant = false;

export default async function StudentResultsPage() {
  const session = await auth();
  const studentId = session!.user.id;

  const attempts = await prisma.testAttempt.findMany({
    where: { studentId, status: { not: "NOT_STARTED" } },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    include: { test: { select: { id: true, title: true, skill: true } } },
  });

  const completed = attempts.filter(
    (a) => a.rawScore !== null && a.totalQuestions !== null
  );
  const banded = completed.filter((a) => a.bandEstimate !== null);

  const avgAccuracy =
    completed.length > 0
      ? Math.round(
          completed.reduce(
            (acc, a) => acc + (a.rawScore! / a.totalQuestions!) * 100,
            0
          ) / completed.length
        )
      : null;

  const bestBand =
    banded.length > 0
      ? Math.max(...banded.map((a) => a.bandEstimate!))
      : null;

  const avgBand =
    banded.length > 0
      ? banded.reduce((acc, a) => acc + a.bandEstimate!, 0) / banded.length
      : null;

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">Results</h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          Your full test history and scores
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <StatCard label="Tests Taken" value={attempts.length} accent />
        <StatCard
          label="Avg Accuracy"
          value={avgAccuracy !== null ? `${avgAccuracy}%` : "—"}
        />
        <StatCard
          label="Avg Band"
          value={avgBand !== null ? avgBand.toFixed(1) : "—"}
          sub="Reading only — not official"
        />
        <StatCard
          label="Best Band"
          value={bestBand !== null ? bestBand.toFixed(1) : "—"}
        />
      </div>

      {attempts.length === 0 ? (
        <div className="bg-white border border-[#DCE6DE] rounded-md p-8 text-center">
          <p className="text-sm text-[#5C6E62]">
            No test attempts yet.{" "}
            <Link href="/student/tests" className="text-[#176B4D] hover:underline">
              View your assigned tests
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#DCE6DE] rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Test</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Date</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Score</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Band</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]">Status</th>
                <th className="px-5 py-2.5 text-xs font-medium text-[#5C6E62]"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr
                  key={attempt.id}
                  className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                >
                  <td className="px-5 py-2.5 text-[#202923] max-w-[220px] truncate">
                    {attempt.test.title}
                  </td>
                  <td className="px-5 py-2.5 text-[#5C6E62] text-xs">
                    {attempt.startedAt
                      ? new Date(attempt.startedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-[#202923]">
                    {attempt.rawScore !== null && attempt.totalQuestions !== null
                      ? `${attempt.rawScore}/${attempt.totalQuestions}`
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-[#176B4D] font-medium">
                    {attempt.bandEstimate !== null
                      ? attempt.bandEstimate.toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={attempt.status} />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {attempt.status === "IN_PROGRESS" ? (
                      <Link
                        href={`/student/tests/${attempt.test.id}/start`}
                        className="text-xs text-[#176B4D] hover:underline"
                      >
                        Resume
                      </Link>
                    ) : (
                      <Link
                        href={`/student/tests/${attempt.test.id}/results?attemptId=${attempt.id}`}
                        className="text-xs text-[#176B4D] hover:underline"
                      >
                        View details
                      </Link>
                    )}
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
    IN_PROGRESS: { label: "In progress", cls: "bg-[#FFF6E0] text-[#B08000]" },
  };
  const info = map[status] ?? { label: status, cls: "bg-[#EDF5EF] text-[#5C6E62]" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${info.cls}`}>
      {info.label}
    </span>
  );
}
