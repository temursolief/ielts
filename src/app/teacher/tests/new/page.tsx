"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateReadingJson } from "@/lib/readingJsonSchema";

const EXAMPLE_JSON = {
  schemaVersion: "1.0",
  title: "IELTS Academic Reading Practice Test 1",
  durationMinutes: 60,
  passages: [
    {
      order: 1,
      title: "The History of the Internet",
      body: "The Internet has its roots in the ARPANET project...",
      questionGroups: [
        {
          type: "TRUE_FALSE_NOT_GIVEN",
          instructions:
            "Do the following statements agree with the information given in the passage? Write TRUE, FALSE, or NOT GIVEN.",
          questions: [
            {
              number: 1,
              stem: "The ARPANET was originally designed for military communication.",
              correctAnswers: ["TRUE"],
            },
          ],
        },
      ],
    },
  ],
};

export default function NewTestPage() {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [errors, setErrors] = useState<{ path: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"edit" | "preview">("edit");
  const [parsed, setParsed] = useState<unknown>(null);

  function handleValidate() {
    setErrors([]);
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      setErrors([{ path: "root", message: "Invalid JSON syntax. Check for missing commas, brackets, or quotes." }]);
      return;
    }

    const result = validateReadingJson(raw);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setParsed(result.data);
    setStep("preview");
  }

  async function handleSave(publish: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed, publish }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      router.push(`/teacher/tests/${json.id}`);
    } catch (e) {
      setErrors([{ path: "root", message: (e as Error).message }]);
      setStep("edit");
    } finally {
      setLoading(false);
    }
  }

  if (step === "preview" && parsed) {
    const data = parsed as ReturnType<typeof Object.create>;
    return (
      <div className="px-8 py-7 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStep("edit")}
            className="text-sm text-[#5C6E62] hover:text-[#202923]"
          >
            ← Back to editor
          </button>
        </div>

        <div className="bg-[#EDF5EF] border border-[#DCE6DE] rounded-md px-5 py-4 mb-6">
          <div className="text-sm font-semibold text-[#176B4D] mb-1">
            Validation passed
          </div>
          <div className="text-sm text-[#202923]">
            <strong>{data.title}</strong> — {data.passages.length} passage
            {data.passages.length !== 1 ? "s" : ""},{" "}
            {data.durationMinutes} minutes
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {data.passages.map(
            (p: {
              order: number;
              title: string;
              body: string;
              questionGroups: { type: string; questions: unknown[] }[];
            }) => (
              <div
                key={p.order}
                className="bg-white border border-[#DCE6DE] rounded-md p-5"
              >
                <div className="text-xs font-medium text-[#5C6E62] mb-1">
                  Passage {p.order}
                </div>
                <h3 className="font-semibold text-[#202923] mb-2">{p.title}</h3>
                <p className="text-sm text-[#5C6E62] line-clamp-3 mb-3">{p.body}</p>
                <div className="text-xs text-[#5C6E62]">
                  {p.questionGroups.reduce(
                    (acc, g) => acc + g.questions.length,
                    0
                  )}{" "}
                  questions across {p.questionGroups.length} group
                  {p.questionGroups.length !== 1 ? "s" : ""}:
                  {p.questionGroups.map((g, i) => (
                    <span key={i} className="ml-1">
                      {g.type.replace(/_/g, " ").toLowerCase()}
                      {i < p.questionGroups.length - 1 ? "," : ""}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="bg-white border border-[#DCE6DE] hover:bg-[#FAFBF8] text-[#202923] text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-60"
          >
            Save as draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="bg-[#176B4D] hover:bg-[#123D30] text-white text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-60"
          >
            {loading ? "Saving…" : "Publish test"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#202923]">Import Reading Test</h1>
        <p className="text-sm text-[#5C6E62] mt-0.5">
          Paste JSON or upload a .json file to create a new test.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-[#202923]">
              Test JSON
            </label>
            <label className="text-xs text-[#176B4D] cursor-pointer hover:underline">
              Upload .json file
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    setJsonText(ev.target?.result as string);
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setErrors([]);
            }}
            spellCheck={false}
            className="w-full h-96 font-mono text-xs text-[#202923] bg-[#FAFBF8] border border-[#DCE6DE] rounded-md p-4 resize-none focus:outline-none focus:border-[#176B4D]"
            placeholder='Paste your test JSON here…'
          />

          {errors.length > 0 && (
            <div className="mt-3 bg-[#F5E5E5] border border-[#B84242]/20 rounded-md p-4">
              <div className="text-sm font-medium text-[#B84242] mb-2">
                Validation errors ({errors.length})
              </div>
              <ul className="space-y-1">
                {errors.map((err, i) => (
                  <li key={i} className="text-xs text-[#B84242]">
                    <span className="font-mono bg-[#B84242]/10 px-1 rounded mr-1">
                      {err.path}
                    </span>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleValidate}
              disabled={!jsonText.trim()}
              className="bg-[#176B4D] hover:bg-[#123D30] text-white text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              Validate & Preview
            </button>
          </div>
        </div>

        {/* Schema reference */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#DCE6DE] rounded-md p-5 sticky top-6">
            <h3 className="text-sm font-semibold text-[#202923] mb-3">
              Schema reference
            </h3>
            <pre className="text-[10px] font-mono text-[#5C6E62] whitespace-pre-wrap leading-relaxed overflow-auto max-h-80">
              {JSON.stringify(EXAMPLE_JSON, null, 2)}
            </pre>
            <button
              onClick={() =>
                setJsonText(JSON.stringify(EXAMPLE_JSON, null, 2))
              }
              className="mt-3 text-xs text-[#176B4D] hover:underline"
            >
              Load example
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
