import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const instant = false;

export default async function TeacherTestsPage() {
  const session = await auth();
  const tests = await prisma.test.findMany({
    where: { teacherId: session!.user.id, skill: "READING" },
    include: {
      _count: { select: { attempts: true, passages: true, assignments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#202923]">Reading Tests</h1>
          <p className="text-sm text-[#5C6E62] mt-0.5">
            {tests.length} test{tests.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/teacher/tests/new"
          className="bg-[#176B4D] hover:bg-[#123D30] text-white text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          Import test
        </Link>
      </div>

      {tests.length === 0 ? (
        <div className="bg-white border border-[#DCE6DE] rounded-md px-8 py-12 text-center">
          <p className="text-sm text-[#5C6E62] mb-4">No tests yet.</p>
          <Link
            href="/teacher/tests/new"
            className="text-sm text-[#176B4D] hover:underline"
          >
            Import your first Reading test →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[#DCE6DE] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DCE6DE] bg-[#FAFBF8] text-left">
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Title</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Status</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Passages</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Assigned</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Attempts</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Updated</th>
                <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr
                  key={test.id}
                  className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                >
                  <td className="px-5 py-3 font-medium text-[#202923]">
                    {test.title}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={test.status} />
                  </td>
                  <td className="px-5 py-3 text-[#5C6E62]">
                    {test._count.passages}
                  </td>
                  <td className="px-5 py-3 text-[#5C6E62]">
                    {test._count.assignments}
                  </td>
                  <td className="px-5 py-3 text-[#5C6E62]">
                    {test._count.attempts}
                  </td>
                  <td className="px-5 py-3 text-[#5C6E62] text-xs">
                    {formatDistanceToNow(test.updatedAt, { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/teacher/tests/${test.id}`}
                        className="text-xs text-[#176B4D] hover:underline"
                      >
                        Manage
                      </Link>
                    </div>
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
    DRAFT: { label: "Draft", cls: "bg-[#F0F0F0] text-[#666]" },
    PUBLISHED: { label: "Published", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    ARCHIVED: { label: "Archived", cls: "bg-[#FFF6E0] text-[#B08000]" },
  };
  const info = map[status] ?? { label: status, cls: "bg-[#EDF5EF] text-[#5C6E62]" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${info.cls}`}>{info.label}</span>
  );
}
