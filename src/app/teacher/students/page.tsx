import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const instant = false;

export default async function StudentsPage() {
  const session = await auth();
  const teacherId = session!.user.id;

  const relations = await prisma.teacherStudent.findMany({
    where: { teacherId },
    include: { student: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  const studentIds = relations.map((r) => r.student.id);

  const [assignments, attempts] = await Promise.all([
    prisma.assignment.findMany({
      where: { teacherId, studentId: { in: studentIds } },
      select: { studentId: true },
    }),
    prisma.testAttempt.findMany({
      where: { studentId: { in: studentIds }, test: { teacherId } },
      select: {
        studentId: true,
        status: true,
        rawScore: true,
        totalQuestions: true,
        bandEstimate: true,
        submittedAt: true,
      },
    }),
  ]);

  const assignedCount = new Map<string, number>();
  assignments.forEach((a) => {
    assignedCount.set(a.studentId, (assignedCount.get(a.studentId) ?? 0) + 1);
  });

  const byStudent = new Map<string, typeof attempts>();
  attempts.forEach((a) => {
    const arr = byStudent.get(a.studentId) ?? [];
    arr.push(a);
    byStudent.set(a.studentId, arr);
  });

  const rows = relations.map((r) => {
    const list = byStudent.get(r.student.id) ?? [];
    const completed = list.filter(
      (a) => a.status === "SUBMITTED" || a.status === "TIME_EXPIRED"
    );
    const withScore = completed.filter(
      (a) => a.rawScore !== null && a.totalQuestions !== null
    );
    const withBand = completed.filter((a) => a.bandEstimate !== null);
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
    const lastActive = list
      .map((a) => a.submittedAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: r.student.id,
      name: r.student.name,
      email: r.student.email,
      joinedAt: r.student.createdAt,
      assignedCount: assignedCount.get(r.student.id) ?? 0,
      completedCount: completed.length,
      accuracy,
      band,
      lastActive: lastActive ?? null,
    };
  });

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">Students</h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          {rows.length} student{rows.length !== 1 ? "s" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-[#DCE6DE] rounded-md px-8 py-12 text-center">
          <p className="text-sm text-[#5C6E62]">No students yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#DCE6DE] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] bg-[#FAFBF8] text-left">
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Name</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Email</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Assigned</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Completed</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Avg Accuracy</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Avg Band</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                >
                  <td className="px-5 py-3 font-medium text-[#202923]">{s.name}</td>
                  <td className="px-5 py-3 text-[#5C6E62]">{s.email}</td>
                  <td className="px-5 py-3 text-[#5C6E62]">{s.assignedCount}</td>
                  <td className="px-5 py-3 text-[#5C6E62]">{s.completedCount}</td>
                  <td className="px-5 py-3 text-[#202923]">
                    {s.accuracy !== null ? `${s.accuracy}%` : "—"}
                  </td>
                  <td className="px-5 py-3 text-[#176B4D] font-medium">
                    {s.band !== null ? s.band.toFixed(1) : "—"}
                  </td>
                  <td className="px-5 py-3 text-[#5C6E62] text-xs">
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
        </div>
      )}

      <p className="text-xs text-[#9CB0A3] mt-4">
        Students are added to your roster when their account is created. A
        self-service invite flow is not yet available.
      </p>
    </div>
  );
}
