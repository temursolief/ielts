/**
 * JSON schema definition and validator for IELTS Reading test import.
 * Schema version: 1.0
 */

import { z } from "zod";

const VALID_QUESTION_TYPES = [
  "MULTIPLE_CHOICE_SINGLE",
  "MULTIPLE_CHOICE_MULTI",
  "TRUE_FALSE_NOT_GIVEN",
  "YES_NO_NOT_GIVEN",
  "MATCHING_HEADINGS",
  "MATCHING_INFORMATION",
  "MATCHING_FEATURES",
  "MATCHING_SENTENCE_ENDINGS",
  "SENTENCE_COMPLETION",
  "SUMMARY_COMPLETION",
  "NOTE_COMPLETION",
  "TABLE_COMPLETION",
  "FLOWCHART_COMPLETION",
  "DIAGRAM_LABEL",
  "SHORT_ANSWER",
] as const;

const questionSchema = z.object({
  number: z.number().int().positive({ message: "Question number must be a positive integer" }),
  stem: z.string().min(1, "Question stem cannot be empty"),
  options: z.array(z.string()).optional(),
  wordLimit: z.number().int().positive().optional().nullable(),
  correctAnswers: z
    .array(z.string().min(1))
    .min(1, "At least one correct answer is required"),
  caseSensitive: z.boolean().optional().default(false),
  explanation: z.string().optional().nullable(),
});

const questionGroupSchema = z.object({
  type: z.enum(VALID_QUESTION_TYPES, {
    error: `Invalid question type. Must be one of: ${VALID_QUESTION_TYPES.join(", ")}`,
  }),
  instructions: z.string().optional().nullable(),
  options: z.array(z.string()).optional().nullable(), // shared options for matching questions
  questions: z
    .array(questionSchema)
    .min(1, "Each question group must contain at least one question"),
});

const passageSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1, "Passage title cannot be empty"),
  body: z.string().min(50, "Passage body is too short — must be at least 50 characters"),
  questionGroups: z
    .array(questionGroupSchema)
    .min(1, "Each passage must have at least one question group"),
});

export const readingTestJsonSchema = z.object({
  schemaVersion: z.string().default("1.0"),
  title: z.string().min(1, "Test title is required"),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(240)
    .default(60),
  passages: z
    .array(passageSchema)
    .min(1, "At least one passage is required")
    .max(10, "Maximum 10 passages per test"),
});

export type ReadingTestJson = z.infer<typeof readingTestJsonSchema>;

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { success: true; data: ReadingTestJson }
  | { success: false; errors: ValidationError[] };

export function validateReadingJson(raw: unknown): ValidationResult {
  const result = readingTestJsonSchema.safeParse(raw);

  if (result.success) {
    // Additional semantic checks
    const errors = semanticValidation(result.data);
    if (errors.length > 0) {
      return { success: false, errors };
    }
    return { success: true, data: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
  }));

  return { success: false, errors };
}

function semanticValidation(data: ReadingTestJson): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for duplicate question numbers
  const allNumbers: number[] = [];
  data.passages.forEach((passage, pi) => {
    passage.questionGroups.forEach((group, gi) => {
      group.questions.forEach((q) => {
        if (allNumbers.includes(q.number)) {
          errors.push({
            path: `passages[${pi}].questionGroups[${gi}].questions`,
            message: `Duplicate question number: ${q.number}. Each question must have a unique number.`,
          });
        }
        allNumbers.push(q.number);
      });
    });
  });

  // Validate passage order uniqueness
  const orders = data.passages.map((p) => p.order);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    errors.push({
      path: "passages",
      message: "Passage order values must be unique.",
    });
  }

  // Check MC questions have options
  data.passages.forEach((passage, pi) => {
    passage.questionGroups.forEach((group, gi) => {
      if (
        (group.type === "MULTIPLE_CHOICE_SINGLE" ||
          group.type === "MULTIPLE_CHOICE_MULTI") &&
        !group.options &&
        !group.questions[0]?.options
      ) {
        // Check individual question options
        const hasOptions = group.questions.some((q) => q.options && q.options.length > 0);
        if (!hasOptions) {
          errors.push({
            path: `passages[${pi}].questionGroups[${gi}]`,
            message: `Multiple choice question group must have options defined at group or question level.`,
          });
        }
      }

      // Check matching questions have group-level options
      if (
        [
          "MATCHING_HEADINGS",
          "MATCHING_INFORMATION",
          "MATCHING_FEATURES",
          "MATCHING_SENTENCE_ENDINGS",
        ].includes(group.type) &&
        (!group.options || group.options.length === 0)
      ) {
        errors.push({
          path: `passages[${pi}].questionGroups[${gi}]`,
          message: `Matching question group (${group.type}) must have group-level options array.`,
        });
      }
    });
  });

  return errors;
}
