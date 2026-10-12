import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const instant = false;

export default async function MyTestsPage() {
  const session = await auth();
  const studentId = session!.user.id;

  const assignments = await prisma.assignment.findMany({
    where: { studentId },
    include: {
      test: { select: { id: true, title: true, durationMin: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const attempts = await prisma.testAttempt.findMany({
    where: { studentId, testId: { in: assignments.map((a) => a.testId) } },
    orderBy: { createdAt: "desc" },
  });

  const latestAttemptByTest = new Map<string, (typeof attempts)[number]>();
  attempts.forEach((a) => {
    if (!latestAttemptByTest.has(a.testId)) latestAttemptByTest.set(a.testId, a);
  });

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">My Tests</h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          {assignments.length} test{assignments.length !== 1 ? "s" : ""} assigned
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white border border-[#DCE6DE] rounded-md px-8 py-12 text-center">
          <p className="text-sm text-[#5C6E62]">
            No tests assigned yet. Check back once your teacher assigns one.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#DCE6DE] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] bg-[#FAFBF8] text-left">
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Title</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Duration</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Due</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Status</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((asgn) => {
                const attempt = latestAttemptByTest.get(asgn.testId);
                const unavailable = asgn.test.status !== "PUBLISHED";
                return (
                  <tr
                    key={asgn.id}
                    className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                  >
                    <td className="px-5 py-3 font-medium text-[#202923]">
                      {asgn.test.title}
                    </td>
                    <td className="px-5 py-3 text-[#5C6E62]">
                      {asgn.test.durationMin} min
                    </td>
                    <td className="px-5 py-3 text-[#5C6E62] text-xs">
                      {asgn.dueDate
                        ? new Date(asgn.dueDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <AssignmentStatusBadge
                        status={unavailable ? "UNAVAILABLE" : attempt?.status ?? "NOT_STARTED"}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <TestAction
                        testId={asgn.test.id}
                        unavailable={unavailable}
                        attempt={attempt}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TestAction({
  testId,
  unavailable,
  attempt,
}: {
  testId: string;
  unavailable: boolean;
  attempt?: { id: string; status: string };
}) {
  if (unavailable) {
    return <span className="text-xs text-[#9CB0A3]">Not available</span>;
  }
  if (!attempt || attempt.status === "NOT_STARTED") {
    return (
      <Link
        href={`/student/tests/${testId}/start`}
        className="text-xs bg-[#176B4D] hover:bg-[#123D30] text-white px-3 py-1.5 rounded transition-colors"
      >
        Start
      </Link>
    );
  }
  if (attempt.status === "IN_PROGRESS") {
    return (
      <Link
        href={`/student/tests/${testId}/start`}
        className="text-xs text-[#176B4D] hover:underline"
      >
        Resume
      </Link>
    );
  }
  return (
    <Link
      href={`/student/tests/${testId}/results?attemptId=${attempt.id}`}
      className="text-xs text-[#176B4D] hover:underline"
    >
      View results
    </Link>
  );
}

function AssignmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    NOT_STARTED: { label: "Not started", cls: "bg-[#F0F0F0] text-[#666]" },
    IN_PROGRESS: { label: "In progress", cls: "bg-[#FFF6E0] text-[#B08000]" },
    SUBMITTED: { label: "Completed", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    TIME_EXPIRED: { label: "Completed", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    TERMINATED_VIOLATION: { label: "Terminated", cls: "bg-[#F5E5E5] text-[#B84242]" },
    UNAVAILABLE: { label: "Unavailable", cls: "bg-[#F0F0F0] text-[#9CB0A3]" },
  };
  const info = map[status] ?? { label: status, cls: "bg-[#EDF5EF] text-[#5C6E62]" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${info.cls}`}>{info.label}</span>
  );
}
