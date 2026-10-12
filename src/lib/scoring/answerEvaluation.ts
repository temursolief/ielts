/**
 * Answer evaluation engine for IELTS Reading.
 * Handles all question types with type-appropriate matching.
 */

import type { QuestionType } from "@prisma/client";

type EvalInput = {
  questionType: QuestionType;
  studentAnswer: unknown; // string | string[]
  acceptedAnswers: string[]; // from AnswerKey
  caseSensitive?: boolean;
  wordLimit?: number | null;
};

export type EvalResult = {
  correct: boolean;
  reason?: string;
};

export function evaluateAnswer(input: EvalInput): EvalResult {
  const { questionType, studentAnswer, acceptedAnswers, caseSensitive = false, wordLimit } = input;

  if (studentAnswer === null || studentAnswer === undefined || studentAnswer === "") {
    return { correct: false, reason: "unanswered" };
  }

  switch (questionType) {
    case "MULTIPLE_CHOICE_SINGLE":
    case "TRUE_FALSE_NOT_GIVEN":
    case "YES_NO_NOT_GIVEN":
    case "MATCHING_HEADINGS":
    case "MATCHING_INFORMATION":
    case "MATCHING_FEATURES":
    case "MATCHING_SENTENCE_ENDINGS":
      return evaluateSingle(studentAnswer as string, acceptedAnswers, caseSensitive);

    case "MULTIPLE_CHOICE_MULTI": {
      const studentArr = Array.isArray(studentAnswer)
        ? (studentAnswer as string[])
        : [studentAnswer as string];
      return evaluateMulti(studentArr, acceptedAnswers, caseSensitive);
    }

    case "SENTENCE_COMPLETION":
    case "SUMMARY_COMPLETION":
    case "NOTE_COMPLETION":
    case "TABLE_COMPLETION":
    case "FLOWCHART_COMPLETION":
    case "DIAGRAM_LABEL":
    case "SHORT_ANSWER": {
      const text = (studentAnswer as string).trim();
      if (wordLimit !== null && wordLimit !== undefined) {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount > wordLimit) {
          return { correct: false, reason: `exceeds word limit of ${wordLimit}` };
        }
      }
      return evaluateSingle(text, acceptedAnswers, caseSensitive);
    }

    default:
      return evaluateSingle(studentAnswer as string, acceptedAnswers, caseSensitive);
  }
}

function normalize(s: string, caseSensitive: boolean): string {
  const trimmed = s.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

function evaluateSingle(
  studentAnswer: string,
  acceptedAnswers: string[],
  caseSensitive: boolean
): EvalResult {
  const studentNorm = normalize(studentAnswer, caseSensitive);
  const correct = acceptedAnswers.some(
    (a) => normalize(a, caseSensitive) === studentNorm
  );
  return { correct };
}

function evaluateMulti(
  studentAnswers: string[],
  acceptedAnswers: string[],
  caseSensitive: boolean
): EvalResult {
  // Multi-select: student must select exactly the accepted answers
  if (studentAnswers.length !== acceptedAnswers.length) {
    return { correct: false, reason: "wrong number of selections" };
  }
  const norm = (s: string) => normalize(s, caseSensitive);
  const studentSet = new Set(studentAnswers.map(norm));
  const correct = acceptedAnswers.every((a) => studentSet.has(norm(a)));
  return { correct };
}
