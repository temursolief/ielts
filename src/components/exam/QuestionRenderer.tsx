"use client";

type Question = {
  id: string;
  number: number;
  stem: string;
  options: string[] | null;
  wordLimit: number | null;
};

type QuestionRendererProps = {
  question: Question;
  groupType: string;
  groupOptions: string[] | null;
  answer: unknown;
  onAnswer: (answer: unknown) => void;
};

export function QuestionRenderer({
  question,
  groupType,
  groupOptions,
  answer,
  onAnswer,
}: QuestionRendererProps) {
  const options = question.options ?? groupOptions ?? [];

  return (
    <div id={`q-${question.id}`} className="scroll-mt-4">
      <div className="flex gap-3">
        <span className="shrink-0 w-6 h-6 flex items-center justify-center bg-[#EDF5EF] text-[#176B4D] text-xs font-bold rounded">
          {question.number}
        </span>
        <div className="flex-1">
          <p className="text-sm text-[#202923] mb-2 leading-relaxed">
            {question.stem}
          </p>

          {/* Multiple choice single */}
          {(groupType === "MULTIPLE_CHOICE_SINGLE") && (
            <div className="space-y-1.5">
              {options.map((opt, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2.5 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    value={opt}
                    checked={answer === opt}
                    onChange={() => onAnswer(opt)}
                    className="mt-0.5 accent-[#176B4D]"
                  />
                  <span className="text-sm text-[#202923] group-hover:text-[#176B4D] transition-colors">
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Multiple choice multi */}
          {groupType === "MULTIPLE_CHOICE_MULTI" && (
            <div className="space-y-1.5">
              {options.map((opt, i) => {
                const selected = Array.isArray(answer) && (answer as string[]).includes(opt);
                return (
                  <label
                    key={i}
                    className="flex items-start gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      value={opt}
                      checked={selected}
                      onChange={(e) => {
                        const current = Array.isArray(answer)
                          ? [...(answer as string[])]
                          : [];
                        if (e.target.checked) {
                          onAnswer([...current, opt]);
                        } else {
                          onAnswer(current.filter((a) => a !== opt));
                        }
                      }}
                      className="mt-0.5 accent-[#176B4D]"
                    />
                    <span className="text-sm text-[#202923] group-hover:text-[#176B4D] transition-colors">
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* TF/YN type */}
          {(groupType === "TRUE_FALSE_NOT_GIVEN" ||
            groupType === "YES_NO_NOT_GIVEN") && (
            <div className="flex gap-2 flex-wrap">
              {(groupType === "TRUE_FALSE_NOT_GIVEN"
                ? ["TRUE", "FALSE", "NOT GIVEN"]
                : ["YES", "NO", "NOT GIVEN"]
              ).map((opt) => (
                <button
                  key={opt}
                  onClick={() => onAnswer(answer === opt ? "" : opt)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors font-medium ${
                    answer === opt
                      ? "bg-[#176B4D] text-white border-[#176B4D]"
                      : "border-[#DCE6DE] text-[#5C6E62] hover:border-[#176B4D] hover:text-[#176B4D]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Matching types */}
          {(groupType === "MATCHING_HEADINGS" ||
            groupType === "MATCHING_INFORMATION" ||
            groupType === "MATCHING_FEATURES" ||
            groupType === "MATCHING_SENTENCE_ENDINGS") && (
            <select
              value={(answer as string) ?? ""}
              onChange={(e) => onAnswer(e.target.value || "")}
              className="text-sm border border-[#DCE6DE] rounded px-3 py-1.5 bg-white text-[#202923] focus:outline-none focus:border-[#176B4D] w-full max-w-xs"
            >
              <option value="">— Select —</option>
              {options.map((opt, i) => (
                <option key={i} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {/* Completion / short answer types */}
          {(groupType === "SENTENCE_COMPLETION" ||
            groupType === "SUMMARY_COMPLETION" ||
            groupType === "NOTE_COMPLETION" ||
            groupType === "TABLE_COMPLETION" ||
            groupType === "FLOWCHART_COMPLETION" ||
            groupType === "DIAGRAM_LABEL" ||
            groupType === "SHORT_ANSWER") && (
            <div>
              <input
                type="text"
                value={(answer as string) ?? ""}
                onChange={(e) => onAnswer(e.target.value)}
                maxLength={question.wordLimit ? question.wordLimit * 15 : 200}
                placeholder={
                  question.wordLimit
                    ? `Max ${question.wordLimit} word${question.wordLimit !== 1 ? "s" : ""}`
                    : "Your answer"
                }
                className="text-sm border border-[#DCE6DE] rounded px-3 py-1.5 w-full max-w-sm bg-white text-[#202923] focus:outline-none focus:border-[#176B4D] placeholder:text-[#9CB0A3]"
              />
              {question.wordLimit && (
                <div className="text-xs text-[#9CB0A3] mt-1">
                  Max {question.wordLimit} word{question.wordLimit !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
