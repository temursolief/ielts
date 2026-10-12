"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuestionRenderer } from "./QuestionRenderer";

type Question = {
  id: string;
  number: number;
  stem: string;
  options: string[] | null;
  wordLimit: number | null;
};

type QuestionGroup = {
  id: string;
  questionType: string;
  instructions: string | null;
  options: string[] | null;
  questions: Question[];
};

type Passage = {
  id: string;
  order: number;
  title: string;
  body: string;
  questionGroups: QuestionGroup[];
};

type Test = {
  id: string;
  title: string;
  passages: Passage[];
};

type Attempt = {
  id: string;
  serverDeadline: string | null;
};

type ExamClientProps = {
  attempt: Attempt;
  test: Test;
  initialAnswers: Record<string, unknown>;
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExamClient({ attempt, test, initialAnswers }: ExamClientProps) {
  const router = useRouter();
  const [activePassageIdx, setActivePassageIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!attempt.serverDeadline) return 3600;
    return Math.max(
      0,
      Math.floor((new Date(attempt.serverDeadline).getTime() - Date.now()) / 1000)
    );
  });
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "error">("synced");
  const [terminated, setTerminated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const saveQueue = useRef<Map<string, unknown>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminatedRef = useRef(false);

  // All questions flat
  const allQuestions = test.passages.flatMap((p) =>
    p.questionGroups.flatMap((g) => g.questions)
  );
  const totalCount = allQuestions.length;

  // Countdown timer
  useEffect(() => {
    if (terminated) return;
    if (timeLeft <= 0) {
      handleExpire();
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          handleExpire();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminated]);

  async function handleExpire() {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    setTerminated(true);
    await fetch(`/api/student/attempts/${attempt.id}/submit`, { method: "POST" });
    router.push(`/student/tests/${test.id}/results?attemptId=${attempt.id}`);
  }

  // Tab-switch detection
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && !terminatedRef.current) {
        terminatedRef.current = true;
        setTerminated(true);
        await fetch(`/api/student/attempts/${attempt.id}/terminate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "TAB_SWITCH" }),
        });
        router.push(
          `/student/tests/${test.id}/results?attemptId=${attempt.id}&terminated=1`
        );
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [attempt.id, test.id, router]);

  // Debounced save
  const flushSaveQueue = useCallback(async () => {
    if (saveQueue.current.size === 0) return;
    setSyncStatus("saving");

    const batch = Array.from(saveQueue.current.entries());
    saveQueue.current.clear();

    try {
      await Promise.all(
        batch.map(([questionId, answer]) =>
          fetch(`/api/student/attempts/${attempt.id}/answers`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, answer }),
          })
        )
      );
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
      // Re-queue
      batch.forEach(([k, v]) => saveQueue.current.set(k, v));
    }
  }, [attempt.id]);

  function handleAnswer(questionId: string, answer: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    saveQueue.current.set(questionId, answer);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSaveQueue, 800);
  }

  async function handleSubmit() {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    setSubmitting(true);

    // Flush pending saves first
    await flushSaveQueue();

    await fetch(`/api/student/attempts/${attempt.id}/submit`, { method: "POST" });
    router.push(`/student/tests/${test.id}/results?attemptId=${attempt.id}`);
  }

  const answeredCount = allQuestions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== "" && a !== null;
  }).length;

  const urgentTime = timeLeft < 300; // < 5 min

  if (terminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBF8]">
        <div className="text-center">
          <div className="text-[#B84242] font-semibold mb-2">Test ended</div>
          <p className="text-sm text-[#5C6E62]">Redirecting to results…</p>
        </div>
      </div>
    );
  }

  const activePassage = test.passages[activePassageIdx];

  return (
    <div className="flex flex-col h-screen bg-[#FAFBF8] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-[#123D30] text-white shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium truncate max-w-xs">{test.title}</span>
          <span className="text-white/40 text-xs">
            {answeredCount}/{totalCount} answered
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Sync status */}
          <span
            className={`text-xs ${
              syncStatus === "error"
                ? "text-[#E8B84B]"
                : syncStatus === "saving"
                ? "text-white/50"
                : "text-white/30"
            }`}
          >
            {syncStatus === "error"
              ? "Sync pending…"
              : syncStatus === "saving"
              ? "Saving…"
              : "Saved"}
          </span>

          {/* Timer */}
          <div
            className={`font-mono font-bold text-base px-3 py-1 rounded ${
              urgentTime
                ? "bg-[#B84242] text-white"
                : "bg-white/10 text-white"
            }`}
          >
            {formatTime(timeLeft)}
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            className="text-sm bg-[#176B4D] hover:bg-[#1E8F68] text-white px-3 py-1.5 rounded transition-colors disabled:opacity-60"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Passage tabs */}
      <div className="flex items-center gap-0 px-5 bg-white border-b border-[#DCE6DE] shrink-0">
        {test.passages.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActivePassageIdx(i)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              i === activePassageIdx
                ? "border-[#176B4D] text-[#176B4D] font-medium"
                : "border-transparent text-[#5C6E62] hover:text-[#202923]"
            }`}
          >
            Passage {p.order}
          </button>
        ))}
      </div>

      {/* Split screen */}
      <div className="flex flex-1 min-h-0">
        {/* Left: passage */}
        <div className="w-1/2 flex flex-col border-r border-[#DCE6DE] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE6DE] bg-white shrink-0">
            <h2 className="font-semibold text-[#202923]">{activePassage.title}</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="passage-body" style={{ whiteSpace: "pre-wrap" }}>
              {activePassage.body}
            </div>
          </div>
        </div>

        {/* Right: questions */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {activePassage.questionGroups.map((group) => (
              <div key={group.id}>
                {group.instructions && (
                  <div className="mb-3 p-3 bg-[#EDF5EF] border border-[#DCE6DE] rounded text-sm text-[#202923] leading-relaxed">
                    {group.instructions}
                  </div>
                )}
                <div className="space-y-4">
                  {group.questions.map((q) => (
                    <QuestionRenderer
                      key={q.id}
                      question={q}
                      groupType={group.questionType}
                      groupOptions={group.options}
                      answer={answers[q.id]}
                      onAnswer={(ans) => handleAnswer(q.id, ans)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Question navigation bar */}
      <div className="px-5 py-2.5 bg-white border-t border-[#DCE6DE] shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {allQuestions.map((q) => {
            const answered =
              answers[q.id] !== undefined &&
              answers[q.id] !== "" &&
              answers[q.id] !== null;
            // Find which passage this question belongs to
            const passageIdx = test.passages.findIndex((p) =>
              p.questionGroups.some((g) =>
                g.questions.some((qq) => qq.id === q.id)
              )
            );
            return (
              <button
                key={q.id}
                onClick={() => {
                  setActivePassageIdx(passageIdx);
                  setTimeout(() => {
                    document
                      .getElementById(`q-${q.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }}
                className={`w-7 h-7 text-xs rounded transition-colors font-medium ${
                  answered
                    ? "bg-[#176B4D] text-white"
                    : "bg-[#EDF5EF] text-[#5C6E62] hover:bg-[#DCE6DE]"
                }`}
              >
                {q.number}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit confirm modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white border border-[#DCE6DE] rounded-md p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="font-semibold text-[#202923] mb-2">Submit test?</h3>
            <p className="text-sm text-[#5C6E62] mb-1">
              {answeredCount} of {totalCount} questions answered.
            </p>
            {answeredCount < totalCount && (
              <p className="text-sm text-[#B84242] mb-4">
                {totalCount - answeredCount} question
                {totalCount - answeredCount !== 1 ? "s" : ""} left unanswered.
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 border border-[#DCE6DE] text-sm py-2 rounded hover:bg-[#FAFBF8] transition-colors"
              >
                Continue test
              </button>
              <button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleSubmit();
                }}
                disabled={submitting}
                className="flex-1 bg-[#176B4D] hover:bg-[#123D30] text-white text-sm py-2 rounded transition-colors disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
