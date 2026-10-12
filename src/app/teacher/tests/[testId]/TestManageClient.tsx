"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

type Student = { id: string; name: string; email: string };

type Attempt = {
  id: string;
  status: string;
  rawScore: number | null;
  totalQuestions: number | null;
  submittedAt: Date | null;
  student: { name: string };
};

type Props = {
  testId: string;
  status: string;
  test: {
    passages: {
      order: number;
      title: string;
      questionGroups: { questions: unknown[] }[];
    }[];
    assignments: { student: Student }[];
    attempts: Attempt[];
  };
  unassignedStudents: Student[];
};

export function TestManageClient({
  testId,
  status,
  test,
  unassignedStudents,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "assign" | "attempts">("overview");
  const [publishing, setPublishing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");

  async function handlePublish() {
    setPublishing(true);
    await fetch(`/api/teacher/tests/${testId}/publish`, { method: "POST" });
    router.refresh();
    setPublishing(false);
  }

  async function handleAssign() {
    if (!selectedStudent) return;
    setAssigning(true);
    await fetch(`/api/teacher/tests/${testId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selectedStudent }),
    });
    setSelectedStudent("");
    router.refresh();
    setAssigning(false);
  }

  const tabs = ["overview", "assign", "attempts"] as const;

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#DCE6DE] mb-5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#176B4D] text-[#176B4D] font-medium"
                : "border-transparent text-[#5C6E62] hover:text-[#202923]"
            }`}
          >
            {tab}
          </button>
        ))}

        {status === "DRAFT" && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="ml-auto mb-1 bg-[#176B4D] hover:bg-[#123D30] text-white text-sm px-4 py-1.5 rounded transition-colors disabled:opacity-60"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        )}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-3">
          {test.passages.map((p) => {
            const qCount = p.questionGroups.reduce(
              (acc, g) => acc + g.questions.length,
              0
            );
            return (
              <div
                key={p.order}
                className="bg-white border border-[#DCE6DE] rounded-md px-5 py-4"
              >
                <div className="text-xs text-[#5C6E62] mb-0.5">
                  Passage {p.order}
                </div>
                <div className="font-medium text-[#202923]">{p.title}</div>
                <div className="text-sm text-[#5C6E62] mt-1">
                  {qCount} question{qCount !== 1 ? "s" : ""} across{" "}
                  {p.questionGroups.length} group
                  {p.questionGroups.length !== 1 ? "s" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "assign" && (
        <div>
          <div className="bg-white border border-[#DCE6DE] rounded-md p-5 mb-5">
            <h3 className="text-sm font-semibold text-[#202923] mb-3">
              Assign to student
            </h3>
            {status !== "PUBLISHED" ? (
              <p className="text-sm text-[#5C6E62]">
                Publish the test first before assigning it to students.
              </p>
            ) : unassignedStudents.length === 0 ? (
              <p className="text-sm text-[#5C6E62]">
                All students are already assigned to this test.
              </p>
            ) : (
              <div className="flex gap-3">
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="flex-1 text-sm border border-[#DCE6DE] rounded px-3 py-2 bg-white text-[#202923] focus:outline-none focus:border-[#176B4D]"
                >
                  <option value="">Select student…</option>
                  {unassignedStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!selectedStudent || assigning}
                  className="bg-[#176B4D] hover:bg-[#123D30] text-white text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
                >
                  {assigning ? "Assigning…" : "Assign"}
                </button>
              </div>
            )}
          </div>

          {test.assignments.length > 0 && (
            <div className="bg-white border border-[#DCE6DE] rounded-md overflow-hidden">
              <div className="px-5 py-3 border-b border-[#DCE6DE] text-sm font-semibold text-[#202923]">
                Assigned students ({test.assignments.length})
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {test.assignments.map((a, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#DCE6DE] last:border-0"
                    >
                      <td className="px-5 py-3 text-[#202923]">
                        {a.student.name}
                      </td>
                      <td className="px-5 py-3 text-[#5C6E62]">
                        {a.student.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "attempts" && (
        <div className="bg-white border border-[#DCE6DE] rounded-md overflow-hidden">
          {test.attempts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#5C6E62]">
              No attempts yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DCE6DE] bg-[#FAFBF8] text-left">
                  <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Student</th>
                  <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Score</th>
                  <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-[#5C6E62]">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {test.attempts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[#DCE6DE] last:border-0 hover:bg-[#FAFBF8]"
                  >
                    <td className="px-5 py-3 text-[#202923]">{a.student.name}</td>
                    <td className="px-5 py-3 text-[#202923]">
                      {a.rawScore !== null && a.totalQuestions !== null
                        ? `${a.rawScore}/${a.totalQuestions}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-3 text-[#5C6E62] text-xs">
                      {a.submittedAt
                        ? formatDistanceToNow(a.submittedAt, {
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
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUBMITTED: { label: "Submitted", cls: "bg-[#EDF5EF] text-[#176B4D]" },
    TIME_EXPIRED: { label: "Expired", cls: "bg-[#FFF6E0] text-[#B08000]" },
    TERMINATED_VIOLATION: {
      label: "Violation",
      cls: "bg-[#F5E5E5] text-[#B84242]",
    },
    IN_PROGRESS: { label: "Active", cls: "bg-[#EDF5EF] text-[#176B4D]" },
  };
  const info = map[status] ?? {
    label: status,
    cls: "bg-[#F0F0F0] text-[#666]",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${info.cls}`}>
      {info.label}
    </span>
  );
}
