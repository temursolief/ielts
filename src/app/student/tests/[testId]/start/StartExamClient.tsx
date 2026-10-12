"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  testId: string;
  testTitle: string;
  durationMin: number;
  passageCount: number;
};

export function StartExamClient({
  testId,
  testTitle,
  durationMin,
  passageCount,
}: Props) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (!acknowledged) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start");
      router.push(`/student/tests/${testId}/exam?attemptId=${json.id}`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFBF8] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-[#DCE6DE] rounded-md overflow-hidden">
          {/* Header */}
          <div className="bg-[#123D30] px-6 py-5">
            <div className="text-xs text-white/50 uppercase tracking-widest mb-1">
              Reading Test
            </div>
            <h1 className="text-lg font-semibold text-white">{testTitle}</h1>
          </div>

          {/* Details */}
          <div className="px-6 py-5 border-b border-[#DCE6DE]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-[#202923]">
                  {durationMin}
                </div>
                <div className="text-xs text-[#5C6E62]">minutes</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#202923]">
                  {passageCount}
                </div>
                <div className="text-xs text-[#5C6E62]">
                  passage{passageCount !== 1 ? "s" : ""}
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#202923]">Auto</div>
                <div className="text-xs text-[#5C6E62]">graded</div>
              </div>
            </div>
          </div>

          {/* Rules */}
          <div className="px-6 py-5">
            <h2 className="text-sm font-semibold text-[#202923] mb-3">
              Important rules
            </h2>
            <div className="bg-[#FFF6E0] border border-[#E8B84B]/30 rounded px-4 py-3 mb-4">
              <p className="text-sm text-[#202923] leading-relaxed">
                <strong>Tab-switch policy:</strong> Once you start this test,
                switching to another browser tab or application will
                automatically end your attempt. Your score will be calculated
                using the answers you have submitted up to that moment. You will
                not be able to reopen this attempt.
              </p>
            </div>
            <ul className="text-sm text-[#5C6E62] space-y-1.5">
              <li>• Your answers are saved automatically as you work.</li>
              <li>• You can navigate between questions freely.</li>
              <li>• The timer runs on the server and cannot be paused.</li>
              <li>
                • If time expires, your attempt is submitted automatically.
              </li>
            </ul>

            {/* Acknowledge */}
            <label className="flex items-start gap-3 mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 accent-[#176B4D]"
              />
              <span className="text-sm text-[#202923]">
                I understand the rules and agree to the tab-switch policy.
              </span>
            </label>

            {error && (
              <p className="mt-3 text-sm text-[#B84242]">{error}</p>
            )}

            <button
              onClick={handleStart}
              disabled={!acknowledged || loading}
              className="mt-5 w-full bg-[#176B4D] hover:bg-[#123D30] text-white text-sm font-semibold py-3 rounded transition-colors disabled:opacity-40"
            >
              {loading ? "Starting…" : "Start test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
